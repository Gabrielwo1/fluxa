import { createHmac, timingSafeEqual } from "node:crypto";
import { q } from "@/lib/erp/db";
import { PLANS, isKind, type Kind } from "@/lib/billing/plans";

// Mercado Pago (checkout transparente): o navegador tokeniza o cartão ou escolhe Pix com o Payment Brick,
// e o servidor cria o pagamento com o preço de PLANS. Mesma estrutura usada no Radar Empresas.
const API = "https://api.mercadopago.com";

export const billingConfigured = () => Boolean(process.env.MP_ACCESS_TOKEN && process.env.NEXT_PUBLIC_MP_PUBLIC_KEY);
export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://fluxa-wine.vercel.app";

export async function mp<T = Record<string, unknown>>(path: string, init?: RequestInit & { idempotency?: string }): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      "content-type": "application/json",
      ...(init?.idempotency ? { "X-Idempotency-Key": init.idempotency } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = body?.message ?? body?.cause?.[0]?.description ?? `Mercado Pago: HTTP ${r.status}`;
    throw Object.assign(new Error(msg), { status: r.status });
  }
  return body as T;
}

export type MpPayment = {
  id: number;
  status: string;
  status_detail: string;
  transaction_amount: number;
  payment_method_id: string;
  external_reference: string | null;
  date_approved: string | null;
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } };
};

// external_reference = "empresa|tipo"
export const makeRef = (tenant: string, kind: Kind) => `${tenant}|${kind}`;
export function readRef(ref: string | null | undefined) {
  const [tenant, kind] = (ref ?? "").split("|");
  return tenant && isKind(kind) ? { tenant, kind } : null;
}

// Confere a assinatura do webhook (x-signature) quando MP_WEBHOOK_SECRET está definido.
export function validSignature(req: Request, dataId: string) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;
  const parts = Object.fromEntries((req.headers.get("x-signature") ?? "").split(",").map((p) => p.trim().split("=") as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${req.headers.get("x-request-id") ?? ""};ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return expected.length === parts.v1.length && timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}

/** Grava o pagamento e libera o plano se aprovado. Idempotente: o mesmo pagamento só é aplicado uma vez. */
export async function applyPayment(p: MpPayment, preapproval?: string | null): Promise<boolean> {
  const ref = readRef(p.external_reference);
  if (!ref) return false;
  const approved = p.status === "approved" && p.transaction_amount + 0.001 >= PLANS[ref.kind].price;
  await q(
    ref.tenant,
    `insert into erp_payments (tenant, id, kind, amount, status, method)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (id) do update set status = excluded.status, updated_at = now() where erp_payments.tenant = $1`,
    [String(p.id), ref.kind, p.transaction_amount, p.status, p.payment_method_id]
  );
  if (!approved) return false;
  const first = await q(ref.tenant, `update erp_payments set applied = true where tenant = $1 and id = $2 and applied = false returning id`, [String(p.id)]);
  if (first.length === 0) return false;
  if (ref.kind === "mensal") {
    await q(
      ref.tenant,
      `insert into erp_subscriptions (tenant, valid_until, recurring, mp_preapproval_id)
       values ($1, now() + interval '30 days', $2, $3)
       on conflict (tenant) do update set
         valid_until = greatest(erp_subscriptions.valid_until, now()) + interval '30 days',
         recurring = erp_subscriptions.recurring or excluded.recurring,
         mp_preapproval_id = coalesce(excluded.mp_preapproval_id, erp_subscriptions.mp_preapproval_id),
         updated_at = now()
       where erp_subscriptions.tenant = $1`,
      [Boolean(preapproval), preapproval ?? null]
    );
  }
  return true;
}

/** Assinatura recorrente no cartão: marca (ou desmarca) a cobrança automática. */
export async function registerSubscription(tenant: string, preapprovalId: string, status: string) {
  const on = status === "authorized";
  await q(
    tenant,
    `insert into erp_subscriptions (tenant, valid_until, recurring, mp_preapproval_id)
     values ($1, now(), $2, $3)
     on conflict (tenant) do update set recurring = $2, mp_preapproval_id = $3, updated_at = now()
     where erp_subscriptions.tenant = $1`,
    [on, preapprovalId]
  );
}

export async function subscriptionOf(tenant: string) {
  const [sub] = await q<{ valid_until: string; recurring: boolean }>(
    tenant,
    `select valid_until, recurring from erp_subscriptions where tenant = $1`,
    []
  );
  const [setup] = await q<{ paid: boolean }>(
    tenant,
    `select exists(select 1 from erp_payments where tenant = $1 and kind = 'implantacao' and status = 'approved') as paid`,
    []
  );
  return {
    valid_until: sub?.valid_until ?? null,
    recurring: sub?.recurring ?? false,
    active: sub ? new Date(sub.valid_until) > new Date() : false,
    setup_paid: setup?.paid ?? false,
  };
}
