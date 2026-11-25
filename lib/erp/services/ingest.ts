import { z } from "zod";
import { HttpError } from "@/lib/tenant";
import { one, q, tx, type Tx } from "@/lib/erp/db";
import { digits, isValidDocument } from "@/lib/erp/validators";
import { cancelSale, confirmInTx, nextNumber, writeItems } from "@/lib/erp/services/sales";
import { payTitle, unpayTitle } from "@/lib/erp/services/finance";

// Dados que chegam de fora: atendente do WhatsApp, loja virtual e Mercado Livre.
// Regra de ouro: reenviar nunca duplica. Cada registro traz o id que tem na origem (external_id),
// guardado em erp_external_refs; na segunda vez o registro é atualizado (ou ignorado se nada mudou).

export const SOURCES = ["atendente", "loja", "mercadolivre"] as const;
export type Source = (typeof SOURCES)[number];

export const SOURCE_LABEL: Record<Source, string> = {
  atendente: "Atendente (WhatsApp)",
  loja: "Loja virtual",
  mercadolivre: "Mercado Livre",
};
// valor gravado em erp_sales.channel
export const CHANNEL: Record<Source, string> = { atendente: "whatsapp", loja: "loja", mercadolivre: "mercadolivre" };
// carteira onde o dinheiro de cada canal entra
const ACCOUNT: Record<Source, string> = { atendente: "WhatsApp", loja: "Loja virtual", mercadolivre: "Mercado Livre" };

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------- formato do que chega ----------

// Texto tolerante: null vira vazio e o excesso é cortado em vez de recusar o registro inteiro.
const s = (max = 200) => z.string().nullish().transform((v) => (v ?? "").trim().slice(0, max));
const num = z.coerce.number().finite().default(0);
const when = z.string().trim().min(8, "Data inválida.");
const optWhen = z.string().nullish().transform((v) => (v ?? "").trim() || null);

const customerSchema = z.object({
  external_id: s(100),
  name: s(200),
  phone: s(30),
  email: s(200),
  document: s(20),
  zip: s(12),
  street: s(),
  number: s(20),
  complement: s(100),
  district: s(100),
  city: s(100),
  state: s(2),
  notes: s(2000),
  origin: s(120),
  first_contact_at: optWhen,
  // true = ainda não comprou (contato do atendente); vira cliente ativo na primeira venda
  lead: z.boolean().default(false),
});

const invoiceSchema = z.object({
  external_id: s(100),
  kind: z.enum(["nfe", "nfse"]).default("nfe"),
  number: s(40),
  access_key: s(60),
  issue_date: when,
  amount: num,
  status: z.enum(["issued", "canceled"]).default("issued"),
  customer_name: s(200),
  customer_document: s(20),
  description: s(300),
  xml: z.string().nullish().transform((v) => (v ? v.slice(0, 2_000_000) : null)),
  // só nas notas enviadas à parte: id do pedido na origem
  order_external_id: s(100),
});

const itemSchema = z.object({
  sku: s(40),
  description: z.string().trim().min(1, "Item sem descrição.").max(300),
  qty: z.coerce.number().gt(0, "Quantidade precisa ser maior que zero."),
  unit_price: z.coerce.number().min(0),
  discount: num,
});

const orderSchema = z.object({
  external_id: z.string().trim().min(1, "Pedido sem identificador.").max(100),
  number: s(40),
  issue_date: when,
  status: z.enum(["paid", "pending", "canceled"]),
  paid_at: optWhen,
  payment_method: s(40),
  items: z.array(itemSchema).max(200).default([]),
  shipping: num,
  discount: num,
  // total cobrado do cliente; se diferir dos itens, a diferença entra como ajuste para o total bater
  total: z.coerce.number().min(0).nullish(),
  notes: s(2000),
  customer: customerSchema.nullish(),
  invoice: invoiceSchema.nullish(),
});

const statsSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dia inválido (use AAAA-MM-DD)."),
  visitors: z.coerce.number().int().min(0).default(0),
  sessions: z.coerce.number().int().min(0).default(0),
  product_views: z.coerce.number().int().min(0).default(0),
  add_to_cart: z.coerce.number().int().min(0).default(0),
  checkouts: z.coerce.number().int().min(0).default(0),
  orders: z.coerce.number().int().min(0).default(0),
  revenue: num,
});

export const ingestSchema = z.object({
  source: z.enum(SOURCES),
  customers: z.array(customerSchema).max(500).default([]),
  orders: z.array(orderSchema).max(500).default([]),
  invoices: z.array(invoiceSchema).max(500).default([]),
  stats: z.array(statsSchema).max(400).default([]),
});

export type IngestInput = z.input<typeof ingestSchema>;
type Customer = z.output<typeof customerSchema>;
type Order = z.output<typeof orderSchema>;
type InvoiceIn = z.output<typeof invoiceSchema>;

export type IngestResult = {
  ok: boolean;
  customers: { created: number; updated: number };
  orders: { created: number; updated: number; skipped: number };
  invoices: { created: number; updated: number };
  stats: number;
  failed: number;
  errors: { kind: string; external_id: string; message: string }[];
};

// ---------- datas ----------

// "2026-11-20" fica como está; um instante ISO vira o dia no fuso do Brasil.
function brDay(v: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `Data inválida: ${v}`);
  return d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

// ---------- referências externas ----------

type RefKind = "party" | "sale" | "invoice";

async function findRef(t: Tx, source: Source, kind: RefKind, externalId: string): Promise<string | null> {
  if (!externalId) return null;
  const r = await t.one<{ local_id: string }>(
    "select local_id from erp_external_refs where tenant = $1 and source = $2 and kind = $3 and external_id = $4",
    [source, kind, externalId]
  );
  return r?.local_id ?? null;
}

async function putRef(t: Tx, source: Source, kind: RefKind, externalId: string, localId: string) {
  if (!externalId) return;
  await t.q(
    `insert into erp_external_refs (tenant, source, kind, external_id, local_id) values ($1,$2,$3,$4,$5)
     on conflict (tenant, source, kind, external_id) do update set local_id = excluded.local_id`,
    [source, kind, externalId, localId]
  );
}

// ---------- clientes ----------

const cleanDocument = (v: string) => (isValidDocument(v) ? digits(v) : "");

// Procura por id da origem, depois por CPF/CNPJ e por último pelo telefone (últimos 11 dígitos, que ignora o 55).
async function findParty(t: Tx, source: Source, c: Customer, doc: string, phone: string): Promise<string | null> {
  const byRef = await findRef(t, source, "party", c.external_id);
  if (byRef) return byRef;
  if (doc) {
    const r = await t.one<{ id: string }>("select id from erp_parties where tenant = $1 and document = $2 limit 1", [doc]);
    if (r) return r.id;
  }
  if (phone.length >= 10) {
    const r = await t.one<{ id: string }>(
      `select id from erp_parties
        where tenant = $1 and phone <> '' and right(regexp_replace(phone, '\\D', '', 'g'), 11) = $2
        order by created_at limit 1`,
      [phone.slice(-11)]
    );
    if (r) return r.id;
  }
  return null;
}

// Cria ou completa o cadastro. Quem já existe só recebe o que faltava: o que a equipe editou à mão não é sobrescrito.
async function upsertParty(t: Tx, source: Source, c: Customer): Promise<{ id: string; created: boolean }> {
  const doc = cleanDocument(c.document);
  const phone = digits(c.phone);
  const found = await findParty(t, source, c, doc, phone);
  if (found) {
    await t.q(
      `update erp_parties set
         phone = case when phone = '' then $3 else phone end,
         email = case when email = '' then $4 else email end,
         document = case when document = '' and $5 <> ''
                          and not exists (select 1 from erp_parties o where o.tenant = $1 and o.document = $5 and o.id <> erp_parties.id)
                         then $5 else document end,
         zip = case when zip = '' then $6 else zip end,
         street = case when street = '' then $7 else street end,
         number = case when number = '' then $8 else number end,
         complement = case when complement = '' then $9 else complement end,
         district = case when district = '' then $10 else district end,
         city = case when city = '' then $11 else city end,
         state = case when state = '' then $12 else state end,
         origin = case when origin = '' then $13 else origin end,
         first_contact_at = coalesce(least(first_contact_at, $14::timestamptz), first_contact_at, $14::timestamptz),
         is_customer = true,
         updated_at = now()
       where tenant = $1 and id = $2`,
      [found, phone, c.email, doc, digits(c.zip), c.street, c.number, c.complement, c.district, c.city, c.state.toUpperCase(),
       c.origin, c.first_contact_at]
    );
    await putRef(t, source, "party", c.external_id, found);
    return { id: found, created: false };
  }
  const name = c.name || (phone ? `Cliente ${phone}` : `Cliente ${c.external_id}`);
  const [row] = await t.q<{ id: string }>(
    `insert into erp_parties (tenant, is_customer, person_type, name, document, email, phone, zip, street, number, complement,
       district, city, state, notes, status, source, origin, first_contact_at)
     values ($1, true, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) returning id`,
    [doc.length === 14 ? "pj" : "pf", name.slice(0, 200), doc, c.email.includes("@") ? c.email : "", phone, digits(c.zip), c.street,
     c.number, c.complement, c.district, c.city, c.state.toUpperCase(), c.notes, c.lead ? "lead" : "active", source, c.origin,
     c.first_contact_at]
  );
  await putRef(t, source, "party", c.external_id, row.id);
  return { id: row.id, created: true };
}

// ---------- produtos ----------

// Produto pelo SKU; se não existe, cria já com controle de estoque: cada venda dá saída e, como ninguém lançou
// entrada, o saldo aparece negativo (é o que já saiu). Compras ou uma contagem acertam depois.
async function productFor(t: Tx, source: Source, sku: string, name: string, price: number): Promise<string | null> {
  if (!sku) return null;
  const find = () => t.one<{ id: string }>("select id from erp_products where tenant = $1 and lower(sku) = lower($2)", [sku]);
  const found = await find();
  if (found) return found.id;
  await t.q(
    `insert into erp_products (tenant, sku, name, kind, track_stock, sale_price, notes)
     values ($1, $2, $3, 'product', true, $4, $5)
     on conflict (tenant, lower(sku)) where sku <> '' do nothing`,
    [sku, name.slice(0, 200), price, `Criado pela integração: ${SOURCE_LABEL[source]}.`]
  );
  return (await find())?.id ?? null;
}

async function channelAccount(t: Tx, source: Source): Promise<string> {
  const find = () => t.one<{ id: string }>("select id from erp_accounts where tenant = $1 and name = $2", [ACCOUNT[source]]);
  const found = await find();
  if (found) return found.id;
  await t.q("insert into erp_accounts (tenant, name, kind) values ($1, $2, 'wallet') on conflict (tenant, name) do nothing", [ACCOUNT[source]]);
  return (await find())!.id;
}

// ---------- notas fiscais ----------

async function upsertInvoice(t: Tx, source: Source, inv: InvoiceIn, saleId: string | null): Promise<"created" | "updated"> {
  const key = digits(inv.access_key);
  const ref = inv.external_id || key;
  let id = ref ? await findRef(t, source, "invoice", ref) : null;
  if (!id && key) {
    id = (await t.one<{ id: string }>("select id from erp_invoices where tenant = $1 and access_key = $2", [key]))?.id ?? null;
  }
  if (id) {
    await t.q(
      `update erp_invoices set status = $3, number = case when number = '' then $4 else number end,
         sale_id = coalesce(sale_id, $5), xml = coalesce(xml, $6), updated_at = now()
       where tenant = $1 and id = $2`,
      [id, inv.status, inv.number, saleId, inv.xml]
    );
    await putRef(t, source, "invoice", ref, id);
    return "updated";
  }
  const [row] = await t.q<{ id: string }>(
    `insert into erp_invoices (tenant, sale_id, kind, number, access_key, issue_date, amount, customer_name, customer_document,
       description, xml, source, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'integration',$12) returning id`,
    [saleId, inv.kind, inv.number, key, brDay(inv.issue_date), Math.max(inv.amount, 0), inv.customer_name,
     digits(inv.customer_document), inv.description, inv.xml, inv.status]
  );
  await putRef(t, source, "invoice", ref, row.id);
  return "created";
}

// ---------- pedidos ----------

type Line = { product_id: string | null; description: string; qty: number; unit_price: number; discount: number; total: number };

async function buildLines(t: Tx, source: Source, o: Order): Promise<{ lines: Line[]; subtotal: number; discount: number; total: number }> {
  const lines: Line[] = [];
  for (const i of o.items) {
    const gross = round2(i.qty * i.unit_price);
    const discount = Math.min(Math.max(i.discount, 0), gross);
    lines.push({
      product_id: await productFor(t, source, i.sku, i.description, i.unit_price),
      description: i.description, qty: i.qty, unit_price: i.unit_price, discount, total: round2(gross - discount),
    });
  }
  if (o.shipping > 0) lines.push({ product_id: null, description: "Frete", qty: 1, unit_price: o.shipping, discount: 0, total: round2(o.shipping) });
  let subtotal = round2(lines.reduce((sum, l) => sum + l.total, 0));
  let discount = Math.min(round2(Math.max(o.discount, 0)), subtotal);
  if (o.total != null) {
    const diff = round2(o.total - (subtotal - discount));
    if (diff > 0.009) {
      lines.push({ product_id: null, description: "Ajuste do canal (taxas, impostos ou juros)", qty: 1, unit_price: diff, discount: 0, total: diff });
      subtotal = round2(subtotal + diff);
    } else if (diff < -0.009) {
      discount = Math.min(round2(discount - diff), subtotal);
    }
  }
  if (lines.length === 0) throw new HttpError(400, "Pedido sem itens e sem total.");
  return { lines, subtotal, discount, total: round2(subtotal - discount) };
}

async function createOrder(tenant: string, source: Source, o: Order, counts: IngestResult): Promise<void> {
  const issue = brDay(o.issue_date);
  await tx(tenant, async (t) => {
    let customerId: string | null = null;
    if (o.customer) {
      const p = await upsertParty(t, source, o.customer);
      customerId = p.id;
      counts.customers[p.created ? "created" : "updated"]++;
    }
    const { lines, subtotal, discount, total } = await buildLines(t, source, o);
    const label = `Pedido ${o.number || o.external_id} · ${SOURCE_LABEL[source]}`;
    const number = await nextNumber(t, "next_sale_number");
    const [sale] = await t.q<{ id: string }>(
      `insert into erp_sales (tenant, number, customer_id, status, issue_date, subtotal, discount, total, payment_method, notes, channel)
       values ($1, $2, $3, 'quote', $4, $5, $6, $7, $8, $9, $10) returning id`,
      [number, customerId, issue, subtotal, discount, total, o.payment_method, [label, o.notes].filter(Boolean).join("\n"), CHANNEL[source]]
    );
    await writeItems(t, sale.id, lines);

    if (o.status === "canceled") {
      await t.q("update erp_sales set status = 'canceled', updated_at = now() where tenant = $1 and id = $2", [sale.id]);
    } else if (o.status === "paid") {
      await confirmInTx(t, sale.id, {
        method: o.payment_method, installments: 1, first_due: issue, interval_days: 30, paid_now: true,
        account_id: await channelAccount(t, source),
      }, { fromChannel: true });
    } else if (customerId) {
      // aguardando pagamento: vira conta a receber em aberto; sem cliente identificado fica como orçamento
      await confirmInTx(t, sale.id, {
        method: o.payment_method, installments: 1, first_due: issue, interval_days: 30, paid_now: false, account_id: null,
      }, { fromChannel: true });
    }
    if (customerId && o.status !== "canceled") {
      await t.q("update erp_parties set status = 'active', updated_at = now() where tenant = $1 and id = $2 and status = 'lead'", [customerId]);
    }
    await putRef(t, source, "sale", o.external_id, sale.id);
    if (o.invoice) {
      const r = await upsertInvoice(t, source, o.invoice, sale.id);
      counts.invoices[r]++;
    }
  });
  counts.orders.created++;
}

// Pedido que já existe: acompanha só a mudança de situação (pagou, cancelou). Item e valor de venda confirmada não mudam.
async function updateOrder(tenant: string, source: Source, saleId: string, o: Order, counts: IngestResult): Promise<void> {
  const cur = await one<{ status: string; issue_date: string }>(
    tenant,
    "select status, issue_date::text as issue_date from erp_sales where tenant = $1 and id = $2",
    [saleId]
  );
  let changed = false;
  if (cur && o.status === "canceled" && cur.status !== "canceled") {
    const paid = await q<{ id: string }>(
      tenant,
      "select id from erp_titles where tenant = $1 and origin_type = 'sale' and origin_id = $2 and status = 'paid'",
      [saleId]
    );
    for (const p of paid) await unpayTitle(tenant, p.id);
    await cancelSale(tenant, saleId);
    changed = true;
  } else if (cur && o.status === "paid" && cur.status !== "canceled") {
    const accountId = await tx(tenant, (t) => channelAccount(t, source));
    const paidAt = o.paid_at ? brDay(o.paid_at) : cur.issue_date;
    if (cur.status === "quote") {
      await tx(tenant, (t) =>
        confirmInTx(t, saleId, { method: o.payment_method, installments: 1, first_due: paidAt, interval_days: 30, paid_now: true, account_id: accountId }, { fromChannel: true })
      );
      changed = true;
    } else {
      const open = await q<{ id: string; amount: number }>(
        tenant,
        "select id, amount::float8 as amount from erp_titles where tenant = $1 and origin_type = 'sale' and origin_id = $2 and status = 'open'",
        [saleId]
      );
      for (const title of open) {
        await payTitle(tenant, title.id, { paid_at: paidAt, paid_amount: title.amount, account_id: accountId });
        changed = true;
      }
    }
  }
  if (o.invoice) {
    const r = await tx(tenant, (t) => upsertInvoice(t, source, o.invoice!, saleId));
    counts.invoices[r]++;
    changed = changed || r === "created";
  }
  counts.orders[changed ? "updated" : "skipped"]++;
}

async function ingestOrder(tenant: string, source: Source, o: Order, counts: IngestResult) {
  const existing = await one<{ local_id: string }>(
    tenant,
    "select local_id from erp_external_refs where tenant = $1 and source = $2 and kind = 'sale' and external_id = $3",
    [source, o.external_id]
  );
  if (existing) await updateOrder(tenant, source, existing.local_id, o, counts);
  else await createOrder(tenant, source, o, counts);
}

// ---------- entrada principal ----------

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

export async function ingest(tenant: string, input: unknown): Promise<IngestResult> {
  const parsed = ingestSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new HttpError(400, `${issue.path.join(".") || "corpo"}: ${issue.message}`);
  }
  const { source, customers, orders, invoices, stats } = parsed.data;
  const r: IngestResult = {
    ok: true,
    customers: { created: 0, updated: 0 },
    orders: { created: 0, updated: 0, skipped: 0 },
    invoices: { created: 0, updated: 0 },
    stats: 0,
    failed: 0,
    errors: [],
  };
  const fail = (kind: string, external_id: string, e: unknown) => {
    r.failed++;
    if (r.errors.length < 50) r.errors.push({ kind, external_id, message: messageOf(e) });
  };

  for (const c of customers) {
    try {
      const p = await tx(tenant, (t) => upsertParty(t, source, c));
      r.customers[p.created ? "created" : "updated"]++;
    } catch (e) {
      fail("customer", c.external_id, e);
    }
  }
  for (const o of orders) {
    try {
      await ingestOrder(tenant, source, o, r);
    } catch (e) {
      fail("order", o.external_id, e);
    }
  }
  for (const inv of invoices) {
    try {
      const sale = inv.order_external_id
        ? await one<{ local_id: string }>(
            tenant,
            "select local_id from erp_external_refs where tenant = $1 and source = $2 and kind = 'sale' and external_id = $3",
            [source, inv.order_external_id]
          )
        : null;
      const res = await tx(tenant, (t) => upsertInvoice(t, source, inv, sale?.local_id ?? null));
      r.invoices[res]++;
    } catch (e) {
      fail("invoice", inv.external_id || inv.number, e);
    }
  }
  for (const d of stats) {
    try {
      await q(
        tenant,
        `insert into erp_channel_stats (tenant, source, day, visitors, sessions, product_views, add_to_cart, checkouts, orders, revenue)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (tenant, source, day) do update set visitors = excluded.visitors, sessions = excluded.sessions,
           product_views = excluded.product_views, add_to_cart = excluded.add_to_cart, checkouts = excluded.checkouts,
           orders = excluded.orders, revenue = excluded.revenue, updated_at = now()`,
        [source, d.day, d.visitors, d.sessions, d.product_views, d.add_to_cart, d.checkouts, d.orders, d.revenue]
      );
      r.stats++;
    } catch (e) {
      fail("stats", d.day, e);
    }
  }

  const created = r.customers.created + r.orders.created + r.invoices.created;
  const updated = r.customers.updated + r.orders.updated + r.invoices.updated + r.stats;
  await q(
    tenant,
    `insert into erp_sync_log (tenant, source, created, updated, skipped, failed, errors)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [source, created, updated, r.orders.skipped, r.failed, JSON.stringify(r.errors)]
  );
  r.ok = r.failed === 0;
  return r;
}

// ---------- painel de integrações ----------

export type SourceOverview = {
  source: Source;
  label: string;
  last_sync: string | null;
  parties: number;
  sales: number;
  revenue: number;
  invoices: number;
  last_30d: { sales: number; revenue: number; visitors: number; sessions: number; product_views: number; add_to_cart: number; checkouts: number; orders: number };
  recent: { at: string; created: number; updated: number; skipped: number; failed: number; errors: { kind: string; external_id: string; message: string }[] }[];
};

export async function overview(tenant: string): Promise<SourceOverview[]> {
  const out: SourceOverview[] = [];
  for (const source of SOURCES) {
    const [counts] = await q<{ parties: number; sales: number; revenue: number; invoices: number; sales30: number; revenue30: number }>(
      tenant,
      `select
         (select count(*) from erp_parties where tenant = $1 and source = $2)::int as parties,
         (select count(*) from erp_sales where tenant = $1 and channel = $3 and status = 'confirmed')::int as sales,
         coalesce((select sum(total) from erp_sales where tenant = $1 and channel = $3 and status = 'confirmed'), 0)::float8 as revenue,
         (select count(*) from erp_external_refs where tenant = $1 and source = $2 and kind = 'invoice')::int as invoices,
         (select count(*) from erp_sales where tenant = $1 and channel = $3 and status = 'confirmed' and issue_date >= erp_today() - 29)::int as sales30,
         coalesce((select sum(total) from erp_sales where tenant = $1 and channel = $3 and status = 'confirmed' and issue_date >= erp_today() - 29), 0)::float8 as revenue30`,
      [source, CHANNEL[source]]
    );
    const [funnel] = await q<{ visitors: number; sessions: number; product_views: number; add_to_cart: number; checkouts: number; orders: number }>(
      tenant,
      `select coalesce(sum(visitors), 0)::int as visitors, coalesce(sum(sessions), 0)::int as sessions,
              coalesce(sum(product_views), 0)::int as product_views, coalesce(sum(add_to_cart), 0)::int as add_to_cart,
              coalesce(sum(checkouts), 0)::int as checkouts, coalesce(sum(orders), 0)::int as orders
         from erp_channel_stats where tenant = $1 and source = $2 and day >= erp_today() - 29`,
      [source]
    );
    const recent = await q<SourceOverview["recent"][number]>(
      tenant,
      `select at, created, updated, skipped, failed, errors from erp_sync_log where tenant = $1 and source = $2 order by at desc limit 8`,
      [source]
    );
    out.push({
      source,
      label: SOURCE_LABEL[source],
      last_sync: recent[0]?.at ?? null,
      parties: counts.parties,
      sales: counts.sales,
      revenue: counts.revenue,
      invoices: counts.invoices,
      last_30d: { sales: counts.sales30, revenue: counts.revenue30, ...funnel },
      recent,
    });
  }
  return out;
}
