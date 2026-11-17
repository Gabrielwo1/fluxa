import { reader, writer, body } from "@/lib/erp/http";
import { q } from "@/lib/erp/db";

const FEATURES = ["prospeccao", "atendimento-ia", "estoque-por-foto", "venda-whatsapp"];

export const GET = reader(async ({ tenant }) => ({
  features: (await q<{ feature: string }>(tenant, "select feature from erp_interest where tenant = $1")).map((r) => r.feature),
}));

// "Quero ser avisado": guarda o interesse da empresa numa função em breve (uma vez por função).
export const POST = writer(async ({ tenant }, req) => {
  const { feature } = (await body(req)) as { feature?: string };
  if (!feature || !FEATURES.includes(feature)) return { ok: false };
  await q(tenant, "insert into erp_interest (tenant, feature) values ($1, $2) on conflict (tenant, feature) do nothing", [feature]);
  return { ok: true };
});
