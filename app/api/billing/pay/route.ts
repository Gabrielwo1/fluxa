import { randomUUID } from "node:crypto";
import { writer, body } from "@/lib/erp/http";
import { HttpError } from "@/lib/tenant";
import { isDemoSlug } from "@/lib/demo";
import { PLANS, isKind } from "@/lib/billing/plans";
import { applyPayment, billingConfigured, makeRef, mp, registerSubscription, siteUrl, type MpPayment } from "@/lib/billing/mercadopago";

type Payer = { email?: string; identification?: { type: string; number: string }; first_name?: string; last_name?: string };
type Data = { token?: string; issuer_id?: string; payment_method_id?: string; installments?: number; payer?: Payer };

// Cria o pagamento com os dados do Payment Brick (cartão ou Pix). O valor vem de PLANS, nunca do navegador.
// Mensalidade no cartão vira assinatura recorrente (preapproval); no Pix vale 30 dias.
export const POST = writer(async ({ tenant, t }, req) => {
  const b = await body(req);
  if (!billingConfigured()) throw new HttpError(503, "O pagamento ainda não foi ligado neste ambiente.");
  if (isDemoSlug(tenant)) throw new HttpError(403, "O pagamento não está disponível na demonstração.");
  const kind = b.tipo;
  const data = (b.dados ?? {}) as Data;
  const method = String(b.metodo ?? "");
  if (!isKind(kind) || !data.payment_method_id) throw new HttpError(400, "Dados de pagamento incompletos.");

  const plan = PLANS[kind];
  const email = data.payer?.email || t.email || undefined;
  const ref = makeRef(tenant, kind);

  try {
    if (kind === "mensal" && method === "credit_card" && data.token) {
      const sub = await mp<{ id: string; status: string }>("/preapproval", {
        method: "POST",
        idempotency: randomUUID(),
        body: JSON.stringify({
          reason: plan.title,
          external_reference: ref,
          payer_email: email,
          card_token_id: data.token,
          auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: plan.price, currency_id: "BRL" },
          back_url: `${siteUrl()}/assinatura`,
          status: "authorized",
        }),
      });
      const ok = sub.status === "authorized";
      if (ok) await registerSubscription(tenant, sub.id, sub.status);
      return { status: ok ? "approved" : "rejected", assinatura: sub.id };
    }

    const pay = await mp<MpPayment>("/v1/payments", {
      method: "POST",
      idempotency: randomUUID(),
      body: JSON.stringify({
        transaction_amount: plan.price,
        description: plan.title,
        payment_method_id: data.payment_method_id,
        token: data.token,
        issuer_id: data.issuer_id,
        installments: Math.min(Math.max(Number(data.installments) || 1, 1), plan.installments),
        payer: { email, identification: data.payer?.identification, first_name: data.payer?.first_name, last_name: data.payer?.last_name },
        external_reference: ref,
        notification_url: `${siteUrl()}/api/billing/webhook`,
        statement_descriptor: "FLUXA",
        metadata: { tenant, tipo: kind },
      }),
    });
    await applyPayment(pay);
    const pix = pay.point_of_interaction?.transaction_data;
    return {
      id: pay.id,
      status: pay.status,
      detalhe: pay.status_detail,
      pix: pix?.qr_code ? { copiaECola: pix.qr_code, qr: pix.qr_code_base64 } : null,
    };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, (e as Error).message);
  }
}, 200);
