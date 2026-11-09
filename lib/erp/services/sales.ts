import { z } from "zod";
import { HttpError } from "@/lib/tenant";
import { q, tx, type Tx } from "@/lib/erp/db";
import { confirmSchema, saleSchema } from "@/lib/erp/schemas";
import type { Sale, SaleItem, Title } from "@/lib/erp/types";
import { addDays, defaultCategoryId, insertTitle, listTitlesByIds, splitAmount } from "@/lib/erp/services/finance";
import { addMove, assertCanRemove } from "@/lib/erp/services/stock";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type SaleFilter = { status?: string; q?: string; from?: string; to?: string; customerId?: string; limit?: number };

const SALE_COLS = `s.id, s.number, s.customer_id, p.name as customer_name, s.status, s.issue_date::text as issue_date,
  s.subtotal::float8 as subtotal, s.discount::float8 as discount, s.total::float8 as total, s.payment_method, s.notes,
  s.confirmed_at`;

export async function listSales(tenant: string, f: SaleFilter = {}): Promise<Sale[]> {
  const where = ["s.tenant = $1"];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replace("?", `$${params.length + 1}`));
  };
  if (f.status && f.status !== "all") add("s.status = ?", f.status);
  if (f.from) add("s.issue_date >= ?::date", f.from);
  if (f.to) add("s.issue_date <= ?::date", f.to);
  if (f.customerId) add("s.customer_id = ?", f.customerId);
  if (f.q?.trim()) {
    params.push(`%${f.q.trim().toLowerCase()}%`);
    where.push(`(lower(p.name) like $${params.length + 1} or s.number::text = ltrim($${params.length + 1}, '%'))`);
  }
  params.push(Math.min(f.limit ?? 300, 1000));
  return q<Sale>(
    tenant,
    `select ${SALE_COLS},
       (select count(*) from erp_sale_items i where i.sale_id = s.id)::int as items_count,
       coalesce((select sum(t.paid_amount) from erp_titles t where t.tenant = s.tenant and t.origin_type = 'sale' and t.origin_id = s.id and t.status = 'paid'), 0)::float8 as received,
       coalesce((select sum(t.amount) from erp_titles t where t.tenant = s.tenant and t.origin_type = 'sale' and t.origin_id = s.id and t.status = 'open'), 0)::float8 as open,
       coalesce((select sum(t.amount) from erp_titles t where t.tenant = s.tenant and t.origin_type = 'sale' and t.origin_id = s.id and t.status = 'open' and t.due_date < erp_today()), 0)::float8 as overdue
     from erp_sales s left join erp_parties p on p.id = s.customer_id
     where ${where.join(" and ")}
     order by s.issue_date desc, s.number desc
     limit $${params.length + 1}`,
    params
  );
}

export async function getSale(tenant: string, id: string): Promise<Sale> {
  const [sale] = await q<Sale>(
    tenant,
    `select ${SALE_COLS} from erp_sales s left join erp_parties p on p.id = s.customer_id where s.tenant = $1 and s.id = $2`,
    [id]
  );
  if (!sale) throw new HttpError(404, "Venda não encontrada.");
  sale.items = await q<SaleItem>(
    tenant,
    `select i.id, i.product_id, i.description, i.qty::float8 as qty, i.unit_price::float8 as unit_price,
            i.unit_cost::float8 as unit_cost, i.discount::float8 as discount, i.total::float8 as total
       from erp_sale_items i join erp_sales s on s.id = i.sale_id
      where s.tenant = $1 and i.sale_id = $2 order by i.position`,
    [id]
  );
  const ids = await q<{ id: string }>(
    tenant,
    "select id from erp_titles where tenant = $1 and origin_type = 'sale' and origin_id = $2 order by due_date",
    [id]
  );
  sale.titles = await listTitlesByIds(tenant, ids.map((r) => r.id));
  const live = sale.titles.filter((t) => t.status !== "canceled");
  sale.received = live.filter((t) => t.status === "paid").reduce((s, t) => s + (t.paid_amount ?? t.amount), 0);
  sale.open = live.filter((t) => t.status === "open").reduce((s, t) => s + t.amount, 0);
  sale.overdue = live.filter((t) => t.overdue).reduce((s, t) => s + t.amount, 0);
  return sale;
}

type ItemInput = z.output<typeof saleSchema>["items"][number];

function totals(items: ItemInput[], discount: number) {
  const lines = items.map((i) => {
    const gross = round2(i.qty * i.unit_price);
    if (i.discount > gross) throw new HttpError(400, `O desconto de "${i.description}" é maior que o valor do item.`);
    return { ...i, total: round2(gross - i.discount) };
  });
  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
  if (discount > subtotal) throw new HttpError(400, "O desconto geral é maior que o total dos itens.");
  return { lines, subtotal, total: round2(subtotal - discount) };
}

async function nextNumber(t: Tx, column: "next_sale_number" | "next_purchase_number"): Promise<number> {
  const row = await t.one<{ n: number }>(
    `update erp_company set ${column} = ${column} + 1 where tenant = $1 returning ${column} - 1 as n`
  );
  return row!.n;
}

async function assertProducts(t: Tx, items: { product_id: string | null }[]) {
  const ids = [...new Set(items.map((i) => i.product_id).filter((x): x is string => Boolean(x)))];
  if (ids.length === 0) return;
  const found = await t.q<{ id: string }>("select id from erp_products where tenant = $1 and id = any($2::uuid[])", [ids]);
  if (found.length !== ids.length) throw new HttpError(404, "Um dos produtos não foi encontrado.");
}

async function assertCustomer(t: Tx, id: string | null) {
  if (!id) return;
  const row = await t.one("select 1 as ok from erp_parties where tenant = $1 and id = $2", [id]);
  if (!row) throw new HttpError(404, "Cliente não encontrado.");
}

async function writeItems(t: Tx, saleId: string, lines: ReturnType<typeof totals>["lines"]) {
  await t.q(
    `delete from erp_sale_items where sale_id = $2 and exists (select 1 from erp_sales where id = $2 and tenant = $1)`,
    [saleId]
  );
  let pos = 0;
  for (const l of lines) {
    await t.q(
      `insert into erp_sale_items (sale_id, product_id, description, qty, unit_price, discount, total, position)
       select id, $2, $3, $4, $5, $6, $7, $8 from erp_sales where tenant = $1 and id = $9`,
      [l.product_id, l.description, l.qty, l.unit_price, l.discount, l.total, pos++, saleId]
    );
  }
}

export async function createSale(tenant: string, input: z.input<typeof saleSchema>): Promise<Sale> {
  const v = saleSchema.parse(input);
  const { lines, subtotal, total } = totals(v.items, v.discount);
  const id = await tx(tenant, async (t) => {
    await assertCustomer(t, v.customer_id);
    await assertProducts(t, v.items);
    const number = await nextNumber(t, "next_sale_number");
    const [row] = await t.q<{ id: string }>(
      `insert into erp_sales (tenant, number, customer_id, issue_date, subtotal, discount, total, payment_method, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [number, v.customer_id, v.issue_date, subtotal, v.discount, total, v.payment_method, v.notes]
    );
    await writeItems(t, row.id, lines);
    if (v.confirm) await confirmInTx(t, row.id, v.confirm);
    return row.id;
  });
  return getSale(tenant, id);
}

export async function updateSale(tenant: string, id: string, input: z.input<typeof saleSchema>): Promise<Sale> {
  const v = saleSchema.parse(input);
  const { lines, subtotal, total } = totals(v.items, v.discount);
  await tx(tenant, async (t) => {
    const cur = await t.one<{ status: string }>("select status from erp_sales where tenant = $1 and id = $2 for update", [id]);
    if (!cur) throw new HttpError(404, "Venda não encontrada.");
    if (cur.status !== "quote") throw new HttpError(409, "Só orçamentos podem ser editados. Cancele a venda e faça outra.");
    await assertCustomer(t, v.customer_id);
    await assertProducts(t, v.items);
    await t.q(
      `update erp_sales set customer_id=$3, issue_date=$4, subtotal=$5, discount=$6, total=$7, payment_method=$8, notes=$9, updated_at=now()
        where tenant = $1 and id = $2`,
      [id, v.customer_id, v.issue_date, subtotal, v.discount, total, v.payment_method, v.notes]
    );
    await writeItems(t, id, lines);
    if (v.confirm) await confirmInTx(t, id, v.confirm);
  });
  return getSale(tenant, id);
}

async function confirmInTx(t: Tx, id: string, pay: z.output<typeof confirmSchema>) {
  const sale = await t.one<{ status: string; number: number; customer_id: string | null; total: number; customer_name: string | null; issue_date: string }>(
    `select s.status, s.number, s.customer_id, s.total::float8 as total, p.name as customer_name, s.issue_date::text as issue_date
       from erp_sales s left join erp_parties p on p.id = s.customer_id
      where s.tenant = $1 and s.id = $2 for update of s`,
    [id]
  );
  if (!sale) throw new HttpError(404, "Venda não encontrada.");
  if (sale.status !== "quote") throw new HttpError(409, "Esta venda já foi confirmada ou cancelada.");
  if (!sale.customer_id && !pay.paid_now && sale.total > 0) {
    throw new HttpError(409, "Para vender a prazo, escolha o cliente. Sem cliente, só dá para receber na hora.");
  }
  if (pay.paid_now && pay.installments > 1) throw new HttpError(400, "Recebimento na hora só vale para 1 parcela.");

  const items = await t.q<{ id: string; product_id: string | null; description: string; qty: number }>(
    "select i.id, i.product_id, i.description, i.qty::float8 as qty from erp_sale_items i join erp_sales s on s.id = i.sale_id where s.tenant = $1 and i.sale_id = $2",
    [id]
  );
  // estoque: confere o total por produto antes de mexer em qualquer coisa
  const perProduct = new Map<string, number>();
  for (const i of items) if (i.product_id) perProduct.set(i.product_id, (perProduct.get(i.product_id) ?? 0) + i.qty);
  for (const [pid, qty] of perProduct) await assertCanRemove(t, pid, qty);

  let hasProduct = false;
  for (const i of items) {
    if (!i.product_id) continue;
    const p = await t.one<{ cost_price: number; track_stock: boolean; kind: string }>(
      "select cost_price::float8 as cost_price, track_stock, kind from erp_products where tenant = $1 and id = $2",
      [i.product_id]
    );
    if (!p) continue;
    if (p.kind === "product") hasProduct = true;
    await t.q(
      "update erp_sale_items set unit_cost = $3 where id = $2 and exists (select 1 from erp_sales where id = $4 and tenant = $1)",
      [i.id, p.cost_price, id]
    );
    if (p.track_stock) {
      await addMove(t, {
        productId: i.product_id, qty: -i.qty, unitCost: p.cost_price, reason: "sale", refType: "sale", refId: id,
        note: `Venda #${sale.number}`,
      });
    }
  }

  if (sale.total > 0) {
    const categoryName = hasProduct || items.every((i) => !i.product_id) ? "Venda de produtos" : "Prestação de serviços";
    const categoryId = await defaultCategoryId(t, "in", categoryName);
    let accountId: string | null = null;
    if (pay.paid_now) {
      accountId = pay.account_id;
      if (!accountId) {
        const acc = await t.one<{ id: string }>(
          "select id from erp_accounts where tenant = $1 and active order by (kind = 'cash') desc, created_at limit 1"
        );
        accountId = acc?.id ?? null;
      }
      if (!accountId) throw new HttpError(409, "Cadastre um caixa ou conta para registrar o recebimento.");
    }
    const parts = splitAmount(sale.total, pay.installments);
    for (let i = 0; i < parts.length; i++) {
      await insertTitle(t, {
        direction: "in",
        description: `Venda #${sale.number}${sale.customer_name ? ` · ${sale.customer_name}` : ""}`,
        partyId: sale.customer_id,
        categoryId,
        amount: parts[i],
        dueDate: pay.paid_now ? sale.issue_date : addDays(pay.first_due, pay.interval_days * i),
        originType: "sale",
        originId: id,
        installmentNo: parts.length > 1 ? i + 1 : null,
        installmentTotal: parts.length > 1 ? parts.length : null,
        paid: pay.paid_now ? { at: sale.issue_date, accountId } : null,
      });
    }
  }
  await t.q(
    "update erp_sales set status = 'confirmed', confirmed_at = now(), payment_method = $3, updated_at = now() where tenant = $1 and id = $2",
    [id, pay.method || ""]
  );
}

export async function confirmSale(tenant: string, id: string, input: z.input<typeof confirmSchema>): Promise<Sale> {
  const pay = confirmSchema.parse(input);
  await tx(tenant, (t) => confirmInTx(t, id, pay));
  return getSale(tenant, id);
}

export async function cancelSale(tenant: string, id: string): Promise<Sale> {
  await tx(tenant, async (t) => {
    const sale = await t.one<{ status: string; number: number }>(
      "select status, number from erp_sales where tenant = $1 and id = $2 for update",
      [id]
    );
    if (!sale) throw new HttpError(404, "Venda não encontrada.");
    if (sale.status === "canceled") return;
    if (sale.status === "confirmed") {
      const paid = await t.one<{ n: number }>(
        "select count(*)::int as n from erp_titles where tenant = $1 and origin_type = 'sale' and origin_id = $2 and status = 'paid'",
        [id]
      );
      if (paid && paid.n > 0) {
        throw new HttpError(409, "Esta venda tem parcelas já recebidas. Desfaça o recebimento em Contas a receber antes de cancelar.");
      }
      const moves = await t.q<{ product_id: string; qty: number; unit_cost: number }>(
        "select product_id, qty::float8 as qty, unit_cost::float8 as unit_cost from erp_stock_moves where tenant = $1 and ref_type = 'sale' and ref_id = $2 and reason = 'sale'",
        [id]
      );
      for (const m of moves) {
        await addMove(t, {
          productId: m.product_id, qty: -m.qty, unitCost: m.unit_cost, reason: "sale_cancel", refType: "sale", refId: id,
          note: `Cancelamento da venda #${sale.number}`,
        });
      }
      await t.q(
        "update erp_titles set status = 'canceled', updated_at = now() where tenant = $1 and origin_type = 'sale' and origin_id = $2 and status = 'open'",
        [id]
      );
    }
    await t.q("update erp_sales set status = 'canceled', updated_at = now() where tenant = $1 and id = $2", [id]);
  });
  return getSale(tenant, id);
}

export async function deleteSale(tenant: string, id: string): Promise<void> {
  const rows = await q<{ status: string }>(tenant, "select status from erp_sales where tenant = $1 and id = $2", [id]);
  if (!rows[0]) throw new HttpError(404, "Venda não encontrada.");
  if (rows[0].status !== "quote") throw new HttpError(409, "Só orçamentos podem ser excluídos. Vendas confirmadas são canceladas.");
  await q(tenant, "delete from erp_sales where tenant = $1 and id = $2", [id]);
}

export type { Title };
