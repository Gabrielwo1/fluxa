// Roda a sincronização das origens (atendente, Mercado Livre, loja) na mão, sem o limite de 60 s do agendador.
// Serve para trazer o histórico antigo ou para forçar uma rodada. As credenciais vêm das mesmas variáveis do
// servidor (ATENDENTE_URL_<EMPRESA>, SHOPIFY_*_<EMPRESA>…) e o banco de DATABASE_URL, do ambiente ou do .env.local.
//
//   npx tsx scripts/sync.ts --tenant miranda --from 2026-01-01
//   npx tsx scripts/sync.ts --tenant miranda --source mercadolivre
import { readFileSync, existsSync } from "fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? undefined : process.argv[i + 1];
};

async function main() {
  const tenant = arg("tenant");
  if (!tenant) {
    console.error("Uso: npx tsx scripts/sync.ts --tenant <empresa> [--from AAAA-MM-DD] [--source atendente|mercadolivre|loja]");
    process.exit(1);
  }
  const { syncTenant } = await import("../lib/erp/services/sync");
  const { SOURCES } = await import("../lib/erp/services/ingest");
  const source = arg("source");
  if (source && !(SOURCES as readonly string[]).includes(source)) throw new Error(`Origem desconhecida: ${source}`);
  let from = arg("from");
  let failed = 0;
  // cada rodada tem tempo de sobra; se uma origem parar no meio, a próxima continua de onde ela parou
  for (let round = 1; round <= 200; round++) {
    const reports = await syncTenant(tenant, { from, budgetMs: 8 * 60_000, sources: source ? [source as (typeof SOURCES)[number]] : undefined });
    from = undefined;
    for (const r of reports) {
      console.log(`${r.source.padEnd(13)} ${r.ok ? "ok  " : "ERRO"} desde ${r.from || "-"}: ${r.created} novos, ${r.updated} atualizados, ${r.failed} itens com erro${r.partial ? " (continua)" : ""}${r.error ? ` · ${r.error}` : ""}`);
    }
    failed = reports.filter((r) => !r.ok).length;
    if (failed || !reports.some((r) => r.partial)) break;
  }
  process.exit(failed ? 2 : 0);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
