import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { HttpError } from "@/lib/tenant";

// Conexão com o Postgres do ERP. Funciona com qualquer Postgres (Supabase, Neon, local):
// basta definir DATABASE_URL (ou POSTGRES_URL, que a Vercel cria nas integrações).
const url = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

export const erpConfigured = () => Boolean(url());

const globalForPool = globalThis as unknown as { __erpPool?: Pool };

function pool(): Pool {
  if (!erpConfigured()) {
    throw new HttpError(
      503,
      "O banco de dados do ERP ainda não está configurado neste ambiente (DATABASE_URL)."
    );
  }
  if (!globalForPool.__erpPool) {
    const local = /localhost|127\.0\.0\.1/.test(url());
    globalForPool.__erpPool = new Pool({
      connectionString: url(),
      ssl: local ? false : { rejectUnauthorized: false },
      // em serverless cada instância abre poucas conexões
      max: 4,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalForPool.__erpPool;
}

// Todas as consultas do app passam por aqui e SEMPRE recebem o tenant como $1.
// Leituras e alterações precisam de "tenant = $1"; inserções precisam gravar o tenant
// como primeira coluna/valor. O helper rejeita qualquer SQL fora desses dois formatos.
const filtersTenant = /\btenant\s*=\s*\$1\b/i;
const insertsTenant = /insert\s+into\s+\w+\s*\(\s*tenant\s*,[^)]*\)\s*(values\s*\(\s*\$1\b|select\s+\$1\b)/i;
const needsTenant = { test: (sql: string) => filtersTenant.test(sql) || insertsTenant.test(sql) };

export async function q<T extends QueryResultRow = QueryResultRow>(
  tenant: string,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  if (!needsTenant.test(sql)) {
    throw new Error("Consulta sem filtro de tenant: " + sql.slice(0, 80));
  }
  return (await pool().query<T>(sql, [tenant, ...params])).rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(
  tenant: string,
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  return (await q<T>(tenant, sql, params))[0] ?? null;
}

export type Tx = {
  tenant: string;
  q<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]>;
  one<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<T | null>;
};

// Transação: tudo ou nada (venda confirmada = itens + estoque + parcelas, por exemplo).
export async function tx<R>(tenant: string, fn: (t: Tx) => Promise<R>): Promise<R> {
  const client: PoolClient = await pool().connect();
  const run = async <T extends QueryResultRow>(sql: string, params: unknown[] = []) => {
    if (!needsTenant.test(sql)) throw new Error("Consulta sem filtro de tenant: " + sql.slice(0, 80));
    return (await client.query<T>(sql, [tenant, ...params])).rows;
  };
  try {
    await client.query("begin");
    const scoped: Tx = {
      tenant,
      q: run as Tx["q"],
      one: (async (sql: string, params?: unknown[]) => (await run(sql, params))[0] ?? null) as Tx["one"],
    };
    const result = await fn(scoped);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
