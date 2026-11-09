import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError, canEdit, getTenant, type Tenant } from "@/lib/tenant";
import { erpConfigured, one, tx } from "@/lib/erp/db";

export type ErpCtx = { tenant: string; t: Tenant; canWrite: boolean };

// Acesso por código (MVP) e modo local editam o ERP; no Supabase, vale o papel do usuário.
export const canWriteErp = (t: Tenant) => t.mode !== "supabase" || canEdit(t);

const DEFAULT_CATEGORIES: [string, "in" | "out"][] = [
  ["Venda de produtos", "in"],
  ["Prestação de serviços", "in"],
  ["Outras receitas", "in"],
  ["Mercadorias e fornecedores", "out"],
  ["Aluguel", "out"],
  ["Salários e encargos", "out"],
  ["Impostos e taxas", "out"],
  ["Água, luz e internet", "out"],
  ["Marketing e anúncios", "out"],
  ["Transporte e frete", "out"],
  ["Serviços de terceiros", "out"],
  ["Outras despesas", "out"],
];

const ready = new Set<string>();

// Primeira vez que a empresa usa o ERP: cria o cadastro, um caixa e as categorias básicas.
export async function ensureCompany(tenant: string, name: string) {
  if (ready.has(tenant)) return;
  const exists = await one(tenant, "select 1 as ok from erp_company where tenant = $1");
  if (!exists) {
    await tx(tenant, async (t) => {
      const created = await t.q(
        "insert into erp_company (tenant, name) values ($1, $2) on conflict (tenant) do nothing returning tenant",
        [name]
      );
      if (created.length === 0) return;
      for (const [catName, kind] of DEFAULT_CATEGORIES) {
        await t.q("insert into erp_categories (tenant, name, kind) values ($1, $2, $3)", [catName, kind]);
      }
      await t.q("insert into erp_accounts (tenant, name, kind) values ($1, 'Caixa', 'cash')");
      await t.q("insert into erp_accounts (tenant, name, kind) values ($1, 'Conta bancária', 'bank')");
    });
  }
  ready.add(tenant);
}

export async function erpContext(opts: { write?: boolean } = {}): Promise<ErpCtx> {
  const t = await getTenant();
  if (!erpConfigured()) {
    throw new HttpError(
      503,
      "O banco de dados do ERP ainda não está configurado neste ambiente (DATABASE_URL)."
    );
  }
  const canWrite = canWriteErp(t);
  if (opts.write && !canWrite) throw new HttpError(403, "Seu acesso é somente leitura");
  await ensureCompany(t.clientSlug, t.clientName);
  return { tenant: t.clientSlug, t, canWrite };
}

const PG_MESSAGES: Record<string, [number, string]> = {
  "23505": [409, "Já existe um registro com esses dados."],
  "23503": [409, "Este registro está em uso em outro lugar e não pode ser removido."],
  "23514": [400, "Algum valor informado não é permitido."],
  "22P02": [400, "Algum valor informado está em formato inválido."],
};

// Converte erros (acesso, validação, banco) em respostas JSON com mensagem em português.
export function erpRoute(
  handler: (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>
) {
  return async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) {
        const issue = e.issues[0];
        return NextResponse.json({ error: issue?.message || "Dados inválidos." }, { status: 400 });
      }
      const code = (e as { code?: string }).code;
      if (code && PG_MESSAGES[code]) {
        const [status, error] = PG_MESSAGES[code];
        return NextResponse.json({ error }, { status });
      }
      console.error("[erp]", e);
      return NextResponse.json({ error: "Algo deu errado. Tente novamente." }, { status: 500 });
    }
  };
}

export const json = (data: unknown, init?: number) => NextResponse.json(data, { status: init ?? 200 });
