import { reader } from "@/lib/erp/http";
import { HttpError } from "@/lib/tenant";
import { applyPayment, billingConfigured, mp, readRef, type MpPayment } from "@/lib/billing/mercadopago";

// Situação de um pagamento (o checkout consulta enquanto o Pix não é pago). Libera o plano se já aprovado.
export const GET = reader(async ({ tenant }, _req, params) => {
  if (!billingConfigured()) throw new HttpError(503, "O pagamento ainda não foi ligado neste ambiente.");
  const p = await mp<MpPayment>(`/v1/payments/${encodeURIComponent(params.id)}`);
  if (readRef(p.external_reference)?.tenant !== tenant) throw new HttpError(404, "Pagamento não encontrado.");
  if (p.status === "approved") await applyPayment(p);
  return { status: p.status, detalhe: p.status_detail };
});
