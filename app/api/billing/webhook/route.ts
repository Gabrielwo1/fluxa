import { applyPayment, mp, readRef, registerSubscription, validSignature, type MpPayment } from "@/lib/billing/mercadopago";

export const runtime = "nodejs";

// Notificações do Mercado Pago. Nunca confia no corpo: sempre busca o pagamento/assinatura na API antes de liberar.
// Rota pública (o Mercado Pago não tem login); a segurança vem de conferir tudo na API e da assinatura x-signature.
type Preapproval = { id: string; status: string; external_reference: string | null };

export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string } };
  const type = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "";
  const id = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  if (!id) return Response.json({ ok: true });
  if (!validSignature(req, id)) return Response.json({ erro: "assinatura inválida" }, { status: 401 });

  try {
    if (type === "payment") {
      const p = await mp<MpPayment & { operation_type?: string }>(`/v1/payments/${id}`);
      // cobranças da assinatura chegam pelo tópico subscription_authorized_payment
      if (p.operation_type !== "recurring_payment") await applyPayment(p);
    } else if (type === "subscription_authorized_payment") {
      const charge = await mp<{ preapproval_id: string; payment?: { id: number } }>(`/authorized_payments/${id}`);
      if (charge.payment?.id) {
        const sub = await mp<Preapproval>(`/preapproval/${charge.preapproval_id}`);
        const p = await mp<MpPayment>(`/v1/payments/${charge.payment.id}`);
        await applyPayment({ ...p, external_reference: sub.external_reference }, sub.id);
      }
    } else if (type === "subscription_preapproval") {
      const sub = await mp<Preapproval>(`/preapproval/${id}`);
      const ref = readRef(sub.external_reference);
      if (ref) await registerSubscription(ref.tenant, sub.id, sub.status);
    }
  } catch (e) {
    // 500 faz o Mercado Pago tentar de novo mais tarde
    return Response.json({ erro: (e as Error).message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
