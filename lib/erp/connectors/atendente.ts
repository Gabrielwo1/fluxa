import type { AtendenteConfig } from "@/lib/erp/connectors/config";
import { chunked, daysBetween, readJson, windowsNewestFirst, type Connector, type ConnectorCtx } from "@/lib/erp/connectors/types";

// Atendente Syntax da Veipar: o Fluxa entra na API do painel com o código de acesso (a mesma sessão de 12 h
// que a equipe usa) e lê o que o atendente já tem. O Mercado Livre vem junto, porque a conta dele está
// conectada ao atendente: o atendente guarda e renova os tokens, o Fluxa só pede os pedidos pela
// rota ?r=api. Assim nenhum segredo do Mercado Livre sai de lá e nada no atendente precisa mudar.

type Session = { get: <T>(path: string) => Promise<T>; tryGet: <T>(path: string) => Promise<T | null> };

async function login(cfg: AtendenteConfig): Promise<Session> {
  const res = await fetch(`${cfg.url}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: cfg.code, slug: cfg.slug }),
    cache: "no-store",
  });
  const { token } = await readJson<{ token: string }>(res, "Atendente (login)");
  const headers = { authorization: `Bearer ${token}` };
  const get = async <T,>(path: string) => readJson<T>(await fetch(`${cfg.url}${path}`, { headers, cache: "no-store" }), `Atendente ${path.split("?")[0]}`);
  return {
    get,
    // consultas de detalhe (endereço, nota): se o Mercado Livre responde 404/erro, o pedido entra sem esse detalhe
    tryGet: async <T,>(path: string) => {
      const res = await fetch(`${cfg.url}${path}`, { headers, cache: "no-store" }).catch(() => null);
      return res?.ok ? ((await res.json().catch(() => null)) as T | null) : null;
    },
  };
}

const phoneOf = (wa: string) => (/^\d{10,15}$/.test(wa) ? wa : "");

type Contact = {
  wa_id: string;
  name: string | null;
  source: string;
  first_seen_at: string;
  ad_source_id: string | null;
  ad_headline: string | null;
  customer_info?: { nome_completo?: string; endereco?: string; observacoes?: string } | null;
  sales?: { id: number }[] | null;
};
type SaleRow = { id: number; wa_id: string; amount: number; sold_at: string; origin: string | null; contacts?: { name: string | null } | null };

export const atendente = (cfg: AtendenteConfig): Connector => ({
  source: "atendente",
  overlapDays: 2,
  async *run(_ctx, from, to) {
    const s = await login(cfg);
    // a API do painel filtra "dos últimos N dias até agora": traz tudo desde "from" e o intervalo vale por inteiro
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const days = Math.min(Math.max(daysBetween(from, today) + 1, 1), 3650);
    const data = await s.get<{ contacts: Contact[]; sales: SaleRow[] }>(`/api/contacts?days=${days}`);
    const names = new Map(data.contacts.map((c) => [c.wa_id, c.customer_info?.nome_completo || c.name || ""]));

    const customers = data.contacts.map((c) => ({
      external_id: c.wa_id,
      name: c.customer_info?.nome_completo || c.name || "",
      phone: phoneOf(c.wa_id),
      street: c.customer_info?.endereco ?? "",
      notes: c.customer_info?.observacoes ?? "",
      origin: c.ad_headline ? `Anúncio: ${c.ad_headline}` : c.ad_source_id ? "Anúncio" : c.source === "manual" ? "Lançado à mão" : "WhatsApp",
      first_contact_at: c.first_seen_at,
      lead: !(c.sales && c.sales.length > 0),
    }));
    const orders = data.sales.map((v) => ({
      external_id: `venda-${v.id}`,
      issue_date: v.sold_at,
      status: "paid",
      notes: "Venda lançada no painel do atendente.",
      items: [{ description: "Venda pelo WhatsApp", qty: 1, unit_price: Number(v.amount) }],
      customer: { external_id: v.wa_id, name: names.get(v.wa_id) || v.contacts?.name || "", phone: phoneOf(v.wa_id) },
    }));

    for (const part of chunked(customers, 200)) yield { payload: { customers: part } };
    const parts = chunked(orders, 100);
    for (let i = 0; i < parts.length; i++) yield { payload: { orders: parts[i] }, window: i === parts.length - 1 ? { from, to } : undefined };
    if (parts.length === 0) yield { payload: {}, window: { from, to } };
  },
});

// ---------------------------------------------------------------------------------------------
// Mercado Livre, pelo atendente.

type MlOrder = {
  id: number;
  date_created: string;
  status: string;
  total_amount: number;
  paid_amount?: number;
  pack_id?: number | null;
  buyer?: { id: number; nickname?: string; first_name?: string; last_name?: string };
  order_items?: { item: { id: string; title: string; seller_sku?: string; seller_custom_field?: string }; quantity: number; unit_price: number }[];
  payments?: { status: string; payment_method_id?: string; date_approved?: string }[];
  shipping?: { id?: number | null } | null;
};

const orderStatus = (s: string) => (s === "paid" ? "paid" : s === "cancelled" || s === "invalid" ? "canceled" : "pending");

async function pool<T, R>(list: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(list.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, list.length) }, async () => {
      while (next < list.length) {
        const i = next++;
        out[i] = await fn(list[i]);
      }
    })
  );
  return out;
}

async function mlOrderPayload(s: Session, o: MlOrder, ctx: ConnectorCtx, knownSale: boolean, knownInvoice: boolean) {
  const proxy = <T,>(path: string) => s.tryGet<{ data: T }>(`/api/mercadolivre?r=api&path=${encodeURIComponent(path)}`).then((r) => r?.data ?? null);
  const pay = (o.payments ?? []).find((p) => p.status === "approved") ?? o.payments?.[0];
  const total = Number(o.paid_amount || o.total_amount);

  // endereço e CPF/CNPJ só na primeira vez que o pedido aparece; depois o cadastro já existe
  let bi: Record<string, string> = {};
  let addr: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any -- resposta do Mercado Livre
  if (!knownSale && o.status !== "cancelled") {
    const [billing, ship] = await Promise.all([
      proxy<any>(`/orders/${o.id}/billing_info`), // eslint-disable-line @typescript-eslint/no-explicit-any
      o.shipping?.id ? proxy<any>(`/shipments/${o.shipping.id}`) : Promise.resolve(null), // eslint-disable-line @typescript-eslint/no-explicit-any
    ]);
    bi = billing?.billing_info ?? billing?.buyer?.billing_info ?? {};
    addr = ship?.receiver_address ?? {};
  }

  // nota fiscal: consulta enquanto o pedido estiver pago e ainda sem nota registrada
  let invoice: Record<string, unknown> | null = null;
  if (!knownInvoice && o.status !== "cancelled") {
    const inv = await proxy<any>(`/users/{user_id}/invoices/orders/${o.id}`); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (inv?.id && inv.status === "authorized") {
      invoice = {
        external_id: String(inv.id),
        kind: "nfe",
        number: String(inv.invoice_number ?? ""),
        access_key: String(inv.attributes?.invoice_key ?? inv.invoice_key ?? ""),
        issue_date: inv.issued_date ?? o.date_created,
        amount: Number(inv.amount ?? total),
        customer_name: o.buyer?.nickname ?? "",
      };
    }
  }

  const fullName = [bi.name, bi.last_name].filter(Boolean).join(" ") || [o.buyer?.first_name, o.buyer?.last_name].filter(Boolean).join(" ") || o.buyer?.nickname || "";
  return {
    external_id: String(o.id),
    issue_date: o.date_created,
    status: orderStatus(o.status),
    paid_at: pay?.date_approved ?? null,
    payment_method: String(pay?.payment_method_id ?? "").slice(0, 40),
    total,
    notes: o.pack_id ? `Pacote ${o.pack_id}` : "",
    items: (o.order_items ?? []).map((i) => ({
      sku: String(i.item?.seller_sku || i.item?.seller_custom_field || i.item?.id || ""),
      description: String(i.item?.title ?? "Item do Mercado Livre"),
      qty: Number(i.quantity),
      unit_price: Number(i.unit_price),
    })),
    customer: {
      external_id: String(o.buyer?.id ?? ""),
      name: fullName,
      document: String(bi.doc_number ?? ""),
      phone: String(addr.receiver_phone ?? ""),
      zip: String(addr.zip_code ?? ""),
      street: String(addr.street_name ?? ""),
      number: String(addr.street_number ?? ""),
      district: String(addr.neighborhood?.name ?? ""),
      city: String(addr.city?.name ?? ""),
      state: String(addr.state?.id ?? "").replace(/^BR-/, ""),
      origin: "Mercado Livre",
    },
    invoice,
  };
}

export const mercadolivre = (cfg: AtendenteConfig): Connector => ({
  source: "mercadolivre",
  // a nota fiscal sai dias depois da venda: relê as duas últimas semanas
  overlapDays: 15,
  async *run(ctx, from, to) {
    const s = await login(cfg);
    const status = await s.get<{ account: unknown }>("/api/mercadolivre?r=status");
    if (!status.account) throw new Error("A conta do Mercado Livre não está conectada no atendente.");

    // semana por semana, da mais recente para a mais antiga: o que acabou de vender aparece primeiro
    for (const w of windowsNewestFirst(from, to, 7)) {
      const orders: MlOrder[] = [];
      for (let offset = 0; ; offset += 50) {
        const path =
          `/orders/search?seller={seller_id}&sort=date_desc&limit=50&offset=${offset}` +
          `&order.date_created.from=${encodeURIComponent(`${w.from}T00:00:00.000-03:00`)}&order.date_created.to=${encodeURIComponent(`${w.to}T23:59:59.999-03:00`)}`;
        const page = await s.get<{ data: { results: MlOrder[]; paging: { total: number } } }>(`/api/mercadolivre?r=api&path=${encodeURIComponent(path)}`);
        orders.push(...(page.data.results ?? []));
        if (offset + 50 >= (page.data.paging?.total ?? 0)) break;
      }
      const slices = chunked(orders, 50);
      for (let i = 0; i < slices.length; i++) {
        const ids = slices[i].map((o) => String(o.id));
        const [sales, invoices] = await Promise.all([ctx.known("sale", "mercadolivre", ids), ctx.known("invoice", "mercadolivre", ids)]);
        const mapped = await pool(slices[i], 8, (o) => mlOrderPayload(s, o, ctx, sales.has(String(o.id)), invoices.has(String(o.id))));
        yield { payload: { orders: mapped }, window: i === slices.length - 1 ? w : undefined };
      }
      if (slices.length === 0) yield { payload: {}, window: w };
    }
  },
});

