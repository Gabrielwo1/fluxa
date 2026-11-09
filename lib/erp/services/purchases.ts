import { z } from "zod";
import { HttpError } from "@/lib/tenant";
import { q, tx, type Tx } from "@/lib/erp/db";
import { confirmSchema, purchaseSchema } from "@/lib/erp/schemas";
import type { Purchase, PurchaseItem } from "@/lib/erp/types";
import { addDays, defaultCategoryId, insertTitle, listTitlesByIds, splitAmount } from "@/lib/erp/services/finance";
import { addMove, assertCanRemove } from "@/lib/erp/services/stock";

const round2 = (n: number) => Math.round(n * 100) / 100;

const COLS = `s.id, s.number, s.supplier_id, p.name as supplier_name, s.status, s.issue_date::text as issue_date,
  s.subtotal::float8 as subtotal, s.discount::float8 as discount, s.total::float8 as total, s.payment_method, s.notes, s.received_at`;

export async function listPurchases(
  tenant: string,
  f: { status?: string; q?: string; from?: string; to?: string; limit?: number } = {}
): Promise<Purchase[]> {
  const where = ["s.tenant = $1"];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replace("?", `$${params.length + 1}`));
  };
  if (f.status && f.status !== "all") add("s.status = ?", f.status);
  if (f.from) add("s.issue_date >= ?::date", f.from);
  if (f.to) add("s.issue_date <= ?::date", f.to);
  if (f.q?.trim()) {
    params.push(`%${f.q.trim().toLowerCase()}%`);
    where.push(`(lower(p.name) like $${params.length + 1} or s.number::text = ltrim($${params.length + 1}, '%'))`);
  }
  params.push(Math.min(f.limit ?? 300, 1000));
  return q<Purchase>(
    tenant,
    `select ${COLS}, (select count(*) from erp_purchase_items i where i.purchase_id = s.id)::int as items_count
       from erp_purchases s left join erp_parties p on p.id = s.supplier_id
      where ${where.join(" and ")} order by s.issue_date desc, s.number desc limit $${params.length + 1}`,
    params
  );
}

export async function getPurchase(tenant: string, id: string): Promise<Purchase> {
  const [row] = await q<Purchase>(
    tenant,
    `select ${COLS} from erp_purchases s left join erp_parties p on p.id = s.supplier_id where s.tenant = $1 and s.id = $2`,
    [id]
  );
  if (!row) throw new HttpError(404, "Compra não encontrada.");
  row.items = await q<PurchaseItem>(
    tenant,
    `select i.id, i.product_id, i.description, i.qty::float8 as qty, i.unit_cost::float8 as unit_cost, i.total::float8 as total
       from erp_purchase_items i join erp_purchases s on s.id = i.purchase_id
      where s.tenant = $1 and i.purchase_id = $2 order by i.position`,
    [id]
  );
  const ids = await q<{ id: string }>(
    tenant,
    "select id from erp_titles where tenant = $1 and origin_type = 'purchase' and origin_id = $2 order by due_date",
    [id]
  );
  row.titles = await listTitlesByIds(tenant, ids.map((r) => r.id));
  return row;
}

type ItemInput = z.output<typeof purchaseSchema>["items"][number];

function totals(items: ItemInput[], discount: number) {
  const lines = items.map((i) => ({ ...i, total: round2(i.qty * i.unit_cost) }));
  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
  if (discount > subtotal) throw new HttpError(400, "O desconto é maior que o total dos itens.");
  return { lines, subtotal, total: round2(subtotal - discount) };
}

async function writeItems(t: Tx, id: string, lines: ReturnType<typeof totals>["lines"]) {
  await t.q(
    "delete from erp_purchase_items where purchase_id = $2 and exists (select 1 from erp_purchases where id = $2 and tenant = $1)",
    [id]
  );
  let pos = 0;
  for (const l of lines) {
    await t.q(
      `insert into erp_purchase_items (purchase_id, product_id, description, qty, unit_cost, total, position)
       select id, $2, $3, $4, $5, $6, $7 from erp_purchases where tenant = $1 and id = $8`,
      [l.product_id, l.description, l.qty, l.unit_cost, l.total, pos++, id]
    );
  }
}

async function checkRefs(t: Tx, supplierId: string | null, items: { product_id: string | null }[]) {
  if (supplierId) {
    const s = await t.one("select 1 as ok from erp_parties where tenant = $1 and id = $2", [supplierId]);
    if (!s) throw new HttpError(404, "Fornecedor não encontrado.");
  }
  const ids = [...new Set(items.map((i) => i.product_id).filter((x): x is string => Boolean(x)))];
  if (ids.length) {
    const found = await t.q<{ id: string }>("select id from erp_products where tenant = $1 and id = any($2::uuid[])", [ids]);
    if (found.length !== ids.length) throw new HttpError(404, "Um dos produtos não foi encontrado.");
  }
}

export async function createPurchase(tenant: string, input: z.input<typeof purchaseSchema>): Promise<Purchase> {
  const v = purchaseSchema.parse(input);
  const { lines, subtotal, total } = totals(v.items, v.discount);
  const id = await tx(tenant, async (t) => {
    await checkRefs(t, v.supplier_id, v.items);
    const n = await t.one<{ n: number }>(
      "update erp_company set next_purchase_number = next_purchase_number + 1 where tenant = $1 returning next_purchase_number - 1 as n"
    );
    const [row] = await t.q<{ id: string }>(
      `insert into erp_purchases (tenant, number, supplier_id, issue_date, subtotal, discount, total, payment_method, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [n!.n, v.supplier_id, v.issue_date, subtotal, v.discount, total, v.payment_method, v.notes]
    );
    await writeItems(t, row.id, lines);
    if (v.receive) await receiveInTx(t, row.id, v.receive);
    return row.id;
  });
  return getPurchase(tenant, id);
}

export async function updatePurchase(tenant: string, id: string, input: z.input<typeof purchaseSchema>): Promise<Purchase> {
  const v = purchaseSchema.parse(input);
  const { lines, subtotal, total } = totals(v.items, v.discount);
  await tx(tenant, async (t) => {
    const cur = await t.one<{ status: string }>("select status from erp_purchases where tenant = $1 and id = $2 for update", [id]);
    if (!cur) throw new HttpError(404, "Compra não encontrada.");
    if (cur.status !== "draft") throw new HttpError(409, "Só pedidos em rascunho podem ser editados.");
    await checkRefs(t, v.supplier_id, v.items);
    await t.q(
      `update erp_purchases set supplier_id=$3, issue_date=$4, subtotal=$5, discount=$6, total=$7, payment_method=$8, notes=$9, updated_at=now()
        where tenant = $1 and id = $2`,
      [id, v.supplier_id, v.issue_date, subtotal, v.discount, total, v.payment_method, v.notes]
    );
    await writeItems(t, id, lines);
    if (v.receive) await receiveInTx(t, id, v.receive);
  });
  return getPurchase(tenant, id);
}

async function receiveInTx(t: Tx, id: string, pay: z.output<typeof confirmSchema>) {
  const p = await t.one<{ status: string; number: number; supplier_id: string | null; total: number; supplier_name: string | null; issue_date: string }>(
    `select s.status, s.number, s.supplier_id, s.total::float8 as total, pr.name as supplier_name, s.issue_date::text as issue_date
       from erp_purchases s left join erp_parties pr on pr.id = s.supplier_id
      where s.tenant = $1 and s.id = $2 for update of s`,
    [id]
  );
  if (!p) throw new HttpError(404, "Compra não encontrada.");
  if (p.status !== "draft") throw new HttpError(409, "Esta compra já foi recebida ou cancelada.");
  if (pay.paid_now && pay.installments > 1) throw new HttpError(400, "Pagamento na hora só vale para 1 parcela.");

  const items = await t.q<{ product_id: string | null; qty: number; unit_cost: number }>(
    "select i.product_id, i.qty::float8 as qty, i.unit_cost::float8 as unit_cost from erp_purchase_items i join erp_purchases s on s.id = i.purchase_id where s.tenant = $1 and i.purchase_id = $2",
    [id]
  );
  for (const i of items) {
    if (!i.product_id) continue;
    const prod = await t.one<{ track_stock: boolean }>("select track_stock from erp_products where tenant = $1 and id = $2", [i.product_id]);
    if (prod?.track_stock) {
      await addMove(t, {
        productId: i.product_id, qty: i.qty, unitCost: i.unit_cost, reason: "purchase", refType: "purchase", refId: id,
        note: `Compra #${p.number}`,
      });
    }
    // o último custo pago vira o custo do produto
    await t.q("update erp_products set cost_price = $2, updated_at = now() where tenant = $1 and id = $3", [i.unit_cost, i.product_id]);
  }

  if (p.total > 0) {
    const categoryId = await defaultCategoryId(t, "out", "Mercadorias e fornecedores");
    let accountId: string | null = null;
    if (pay.paid_now) {
      accountId = pay.account_id;
      if (!accountId) {
        const acc = await t.one<{ id: string }>(
          "select id from erp_accounts where tenant = $1 and active order by (kind = 'cash') desc, created_at limit 1"
        );
        accountId = acc?.id ?? null;
      }
      if (!accountId) throw new HttpError(409, "Cadastre um caixa ou conta para registrar o pagamento.");
    }
    const parts = splitAmount(p.total, pay.installments);
    for (let i = 0; i < parts.length; i++) {
      await insertTitle(t, {
        direction: "out",
        description: `Compra #${p.number}${p.supplier_name ? ` · ${p.supplier_name}` : ""}`,
        partyId: p.supplier_id,
        categoryId,
        amount: parts[i],
        dueDate: pay.paid_now ? p.issue_date : addDays(pay.first_due, pay.interval_days * i),
        originType: "purchase",
        originId: id,
        installmentNo: parts.length > 1 ? i + 1 : null,
        installmentTotal: parts.length > 1 ? parts.length : null,
        paid: pay.paid_now ? { at: p.issue_date, accountId } : null,
      });
    }
  }
  await t.q(
    "update erp_purchases set status = 'received', received_at = now(), payment_method = $3, updated_at = now() where tenant = $1 and id = $2",
    [id, pay.method || ""]
  );
}

export async function receivePurchase(tenant: string, id: string, input: z.input<typeof confirmSchema>): Promise<Purchase> {
  const pay = confirmSchema.parse(input);
  await tx(tenant, (t) => receiveInTx(t, id, pay));
  return getPurchase(tenant, id);
}

export async function cancelPurchase(tenant: string, id: string): Promise<Purchase> {
  await tx(tenant, async (t) => {
    const p = await t.one<{ status: string; number: number }>(
      "select status, number from erp_purchases where tenant = $1 and id = $2 for update",
      [id]
    );
    if (!p) throw new HttpError(404, "Compra não encontrada.");
    if (p.status === "canceled") return;
    if (p.status === "received") {
      const paid = await t.one<{ n: number }>(
        "select count(*)::int as n from erp_titles where tenant = $1 and origin_type = 'purchase' and origin_id = $2 and status = 'paid'",
        [id]
      );
      if (paid && paid.n > 0) {
        throw new HttpError(409, "Esta compra tem parcelas já pagas. Desfaça o pagamento em Contas a pagar antes de cancelar.");
      }
      const moves = await t.q<{ product_id: string; qty: number; unit_cost: number }>(
        "select product_id, qty::float8 as qty, unit_cost::float8 as unit_cost from erp_stock_moves where tenant = $1 and ref_type = 'purchase' and ref_id = $2 and reason = 'purchase'",
        [id]
      );
      for (const m of moves) await assertCanRemove(t, m.product_id, m.qty);
      for (const m of moves) {
        await addMove(t, {
          productId: m.product_id, qty: -m.qty, unitCost: m.unit_cost, reason: "purchase_cancel", refType: "purchase", refId: id,
          note: `Cancelamento da compra #${p.number}`,
        });
      }
      await t.q(
        "update erp_titles set status = 'canceled', updated_at = now() where tenant = $1 and origin_type = 'purchase' and origin_id = $2 and status = 'open'",
        [id]
      );
    }
    await t.q("update erp_purchases set status = 'canceled', updated_at = now() where tenant = $1 and id = $2", [id]);
  });
  return getPurchase(tenant, id);
}

export async function deletePurchase(tenant: string, id: string): Promise<void> {
  const rows = await q<{ status: string }>(tenant, "select status from erp_purchases where tenant = $1 and id = $2", [id]);
  if (!rows[0]) throw new HttpError(404, "Compra não encontrada.");
  if (rows[0].status !== "draft") throw new HttpError(409, "Só rascunhos podem ser excluídos. Compras recebidas são canceladas.");
  await q(tenant, "delete from erp_purchases where tenant = $1 and id = $2", [id]);
}
