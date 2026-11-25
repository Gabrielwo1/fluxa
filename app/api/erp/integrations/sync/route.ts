import { writer } from "@/lib/erp/http";
import { connectorsFor, syncTenant } from "@/lib/erp/services/sync";
import { HttpError } from "@/lib/tenant";

export const maxDuration = 300;

// "Sincronizar agora" da tela de Integrações: mesma rodada do agendador, para a empresa logada.
export const POST = writer(async ({ tenant }) => {
  if (connectorsFor(tenant).length === 0) throw new HttpError(409, "Nenhuma origem configurada para esta empresa (veja docs/INTEGRACOES.md).");
  return { reports: await syncTenant(tenant, { budgetMs: 240_000 }) };
});
