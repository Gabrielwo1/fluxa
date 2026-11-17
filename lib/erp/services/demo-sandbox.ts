import { randomBytes } from "crypto";
import { HttpError } from "@/lib/tenant";
import { adminQuery } from "@/lib/erp/db";
import { ensureCompany } from "@/lib/erp/auth";
import { loadDemo } from "@/lib/erp/services/demo";
import { DEMO_HOURS, DEMO_PREFIX, DEMO_TEMPLATE } from "@/lib/demo";

const MAX_SANDBOXES = 150;
const TEMPLATE_MAX_AGE_DAYS = 5;

// O modelo (com vendas, estoque, contas...) é montado uma vez e refeito a cada poucos dias,
// para as datas ficarem recentes. As cópias dos visitantes saem dele em uma só chamada.
export async function ensureTemplate(): Promise<void> {
  const [row] = await adminQuery<{ old: boolean; has: boolean }>(
    `select (created_at < now() - ($2 || ' days')::interval) as old, has_demo as has from erp_company where tenant = $1`,
    [DEMO_TEMPLATE, String(TEMPLATE_MAX_AGE_DAYS)]
  );
  if (row && !row.old && row.has) return;
  if (row) await adminQuery("select erp_purge_tenant($1)", [DEMO_TEMPLATE]);
  await ensureCompany(DEMO_TEMPLATE, "Modelo da demonstração");
  await loadDemo(DEMO_TEMPLATE);
}

export async function createSandbox(): Promise<string> {
  const [n] = await adminQuery<{ n: number }>("select count(*)::int as n from erp_company where tenant like $1 and tenant <> $2", [`${DEMO_PREFIX}%`, DEMO_TEMPLATE]);
  if (n.n >= MAX_SANDBOXES) throw new HttpError(429, "Muitas demonstrações abertas agora. Tente de novo em alguns minutos.");
  await ensureTemplate();
  const slug = `${DEMO_PREFIX}${randomBytes(4).toString("hex")}`;
  await adminQuery("select erp_clone_tenant($1, $2)", [DEMO_TEMPLATE, slug]);
  return slug;
}

// Apaga as demonstrações com mais de 24 h (o modelo fica).
export async function purgeOldSandboxes(): Promise<number> {
  const old = await adminQuery<{ tenant: string }>(
    `select tenant from erp_company where tenant like $1 and tenant <> $2 and created_at < now() - ($3 || ' hours')::interval`,
    [`${DEMO_PREFIX}%`, DEMO_TEMPLATE, String(DEMO_HOURS)]
  );
  for (const { tenant } of old) await adminQuery("select erp_purge_tenant($1)", [tenant]);
  return old.length;
}
