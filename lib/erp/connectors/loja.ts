import type { LojaConfig } from "@/lib/erp/connectors/config";
import { chunked, daysBetween, readJson, type Connector } from "@/lib/erp/connectors/types";
import { digits } from "@/lib/erp/validators";

// Loja virtual da Veipar (Shopify). O Fluxa lê os pedidos direto na Admin API da Shopify, com o mesmo app
// que a loja já usa, e os números de acesso (visitas, carrinho, checkout) do banco onde a loja grava os eventos.

// aceita o domínio (veipar.myshopify.com) ou um endereço completo (só os testes usam o segundo)
const base = (cfg: LojaConfig) => (/^https?:/.test(cfg.shopDomain) ? cfg.shopDomain : `https://${cfg.shopDomain}`);
const brDay = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

let cached: { key: string; token: string; expires: number } | null = null;

async function shopifyToken(cfg: LojaConfig): Promise<string> {
  const key = `${cfg.shopDomain}:${cfg.clientId}`;
  if (cached && cached.key === key && cached.expires > Date.now() + 60_000) return cached.token;
  const res = await fetch(`${base(cfg)}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: cfg.clientId, client_secret: cfg.clientSecret }),
    cache: "no-store",
  });
  const data = await readJson<{ access_token: string; expires_in?: number }>(res, "Shopify (token)");
  cached = { key, token: data.access_token, expires: Date.now() + (data.expires_in ?? 86_400) * 1000 };
  return data.access_token;
}

type Money = { shopMoney: { amount: string } };
type ShopifyOrder = {
  id: string;
  name: string;
  createdAt: string;
  cancelledAt: string | null;
  displayFinancialStatus: string | null;
  note?: string | null;
  email?: string | null;
  phone?: string | null;
  paymentGatewayNames?: string[];
  totalPriceSet: Money;
  totalShippingPriceSet: Money | null;
  customer?: { id: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null } | null;
  shippingAddress?: { name: string | null; phone: string | null; zip: string | null; address1: string | null; address2: string | null; city: string | null; provinceCode: string | null } | null;
  lineItems: { nodes: { sku: string | null; title: string; quantity: number; originalUnitPriceSet: Money; totalDiscountSet: Money }[] };
};

// Os dados pessoais (cliente, endereço) exigem acesso extra do app na Shopify; sem ele, vem só o pedido.
const FIELDS = (pii: boolean) => `
  id name createdAt cancelledAt displayFinancialStatus note paymentGatewayNames
  totalPriceSet { shopMoney { amount } }
  totalShippingPriceSet { shopMoney { amount } }
  ${pii ? `email phone customer { id firstName lastName email phone }
  shippingAddress { name phone zip address1 address2 city provinceCode }` : ""}
  lineItems(first: 100) { nodes { sku title quantity originalUnitPriceSet { shopMoney { amount } } totalDiscountSet { shopMoney { amount } } } }`;

async function graphql<T>(cfg: LojaConfig, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${base(cfg)}/admin/api/${cfg.apiVersion}/graphql.json`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-shopify-access-token": await shopifyToken(cfg) },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const json = await readJson<{ data?: T; errors?: unknown }>(res, "Shopify");
  if (json.errors || !json.data) {
    if (JSON.stringify(json.errors ?? "").includes("ACCESS_DENIED")) cached = null;
    throw new Error(`Shopify: ${JSON.stringify(json.errors ?? "sem dados").slice(0, 300)}`);
  }
  return json.data;
}

const paymentOf = (o: ShopifyOrder) => (o.paymentGatewayNames?.[0] ?? "").slice(0, 40);

function status(o: ShopifyOrder): "paid" | "pending" | "canceled" {
  const f = o.displayFinancialStatus ?? "";
  if (o.cancelledAt || ["REFUNDED", "VOIDED", "EXPIRED"].includes(f)) return "canceled";
  return ["PAID", "PARTIALLY_REFUNDED"].includes(f) ? "paid" : "pending";
}

function toOrder(o: ShopifyOrder) {
  const c = o.customer;
  const a = o.shippingAddress;
  const email = c?.email || o.email || "";
  const name = [c?.firstName, c?.lastName].filter(Boolean).join(" ") || a?.name || "";
  const hasCustomer = Boolean(c?.id || email || name);
  return {
    external_id: o.id.split("/").pop() ?? o.id,
    number: o.name,
    issue_date: o.createdAt,
    status: status(o),
    payment_method: paymentOf(o),
    shipping: Number(o.totalShippingPriceSet?.shopMoney.amount ?? 0),
    total: Number(o.totalPriceSet.shopMoney.amount),
    notes: o.note ?? "",
    items: o.lineItems.nodes.map((i) => ({
      sku: i.sku ?? "",
      description: i.title,
      qty: i.quantity,
      unit_price: Number(i.originalUnitPriceSet.shopMoney.amount),
      discount: Number(i.totalDiscountSet.shopMoney.amount),
    })),
    customer: hasCustomer
      ? {
          external_id: c?.id ? (c.id.split("/").pop() ?? c.id) : email,
          name,
          email,
          phone: digits(c?.phone || o.phone || a?.phone || ""),
          zip: a?.zip ?? "",
          street: [a?.address1, a?.address2].filter(Boolean).join(", "),
          city: a?.city ?? "",
          state: a?.provinceCode ?? "",
          origin: "Loja virtual",
        }
      : null,
  };
}

type Metrics = { visitantes: number; sessoes: number; funil: { produto: number; carrinho: number; checkout: number } };

async function dayMetrics(cfg: LojaConfig, day: string): Promise<Metrics> {
  const res = await fetch(`${cfg.metricsUrl}/rest/v1/rpc/loja_metricas`, {
    method: "POST",
    headers: { apikey: cfg.metricsKey, authorization: `Bearer ${cfg.metricsKey}`, "content-type": "application/json" },
    body: JSON.stringify({ desde: `${day}T00:00:00-03:00`, ate: `${addDays(day, 1)}T00:00:00-03:00` }),
    cache: "no-store",
  });
  return readJson<Metrics>(res, "Acessos da loja");
}

export const loja = (cfg: LojaConfig): Connector => ({
  source: "loja",
  // pedido pago ou cancelado depois da compra aparece como atualizado: relê os últimos dias
  overlapDays: 3,
  async *run(ctx, from, to) {
    let pii = true;
    let after: string | null = null;
    const byDay = new Map<string, { orders: number; revenue: number }>();
    // sortKey UPDATED_AT pega pedido que mudou de situação, não só os novos
    const q = `updated_at:>='${from}T00:00:00-03:00'`;
    for (;;) {
      type Page = { orders: { nodes: ShopifyOrder[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } };
      let data: Page;
      try {
        data = await graphql<Page>(cfg, `query Pedidos($q: String!, $after: String) { orders(first: 100, after: $after, query: $q, sortKey: UPDATED_AT) { nodes { ${FIELDS(pii)} } pageInfo { hasNextPage endCursor } } }`, { q, after });
      } catch (e) {
        if (!pii || !/ACCESS_DENIED|protected|not approved/i.test((e as Error).message)) throw e;
        // o app não tem acesso aos dados pessoais: segue só com os pedidos
        pii = false;
        ctx.warn("A Shopify negou o acesso aos dados dos clientes (nome, e-mail, endereço): os pedidos entram sem cliente. Libere o acesso a dados protegidos no app da loja.");
        continue;
      }
      const orders = data.orders.nodes;
      for (const o of orders) {
        if (status(o) === "canceled") continue;
        const d = brDay(o.createdAt);
        const cur = byDay.get(d) ?? { orders: 0, revenue: 0 };
        byDay.set(d, { orders: cur.orders + 1, revenue: cur.revenue + Number(o.totalPriceSet.shopMoney.amount) });
      }
      for (const part of chunked(orders.map(toOrder), 100)) yield { payload: { orders: part } };
      if (!data.orders.pageInfo.hasNextPage) break;
      after = data.orders.pageInfo.endCursor;
    }

    // números por dia: acessos (se a loja grava no banco informado) + pedidos e faturamento do que veio da Shopify
    const days = Array.from({ length: Math.min(daysBetween(from, to) + 1, 45) }, (_, i) => addDays(to, -i)).reverse();
    const stats = [];
    for (const day of days) {
      let m: Metrics | null = null;
      if (cfg.metricsUrl && cfg.metricsKey) {
        m = await dayMetrics(cfg, day).catch((e: Error) => {
          ctx.warn(`Acessos da loja indisponíveis (${e.message}); o funil fica sem esses dias.`);
          return null;
        });
      }
      const o = byDay.get(day);
      if (!m && !o) continue;
      stats.push({
        day,
        visitors: m?.visitantes ?? 0,
        sessions: m?.sessoes ?? 0,
        product_views: m?.funil.produto ?? 0,
        add_to_cart: m?.funil.carrinho ?? 0,
        checkouts: m?.funil.checkout ?? 0,
        orders: o?.orders ?? 0,
        revenue: Math.round((o?.revenue ?? 0) * 100) / 100,
      });
    }
    yield { payload: { stats }, until: to };
  },
});
