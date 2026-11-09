import { z } from "zod";
import { HttpError } from "@/lib/tenant";
import { q, tx, type Tx } from "@/lib/erp/db";
import { stockMoveSchema } from "@/lib/erp/schemas";
import type { StockMove, StockReason } from "@/lib/erp/types";

export async function listMoves(tenant: string, f: { productId?: string; limit?: number } = {}): Promise<StockMove[]> {
  const params: unknown[] = [];
  let extra = "";
  if (f.productId) {
    params.push(f.productId);
    extra = `and m.product_id = $2`;
  }
  params.push(Math.min(f.limit ?? 200, 1000));
  return q<StockMove>(
    tenant,
    `select m.id, m.product_id, p.name as product_name, p.unit, m.qty::float8 as qty, m.unit_cost::float8 as unit_cost,
            m.reason, m.ref_type, m.ref_id, m.note, m.created_at
       from erp_stock_moves m join erp_products p on p.id = m.product_id
      where m.tenant = $1 ${extra}
      order by m.created_at desc, m.id limit $${params.length + 1}`,
    params
  );
}

export async function balanceOf(t: Tx, productId: string): Promise<number> {
  const row = await t.one<{ s: number }>(
    "select coalesce(sum(qty), 0)::float8 as s from erp_stock_moves where tenant = $1 and product_id = $2",
    [productId]
  );
  return row?.s ?? 0;
}

export async function allowsNegative(t: Tx): Promise<boolean> {
  const row = await t.one<{ a: boolean }>("select allow_negative_stock as a from erp_company where tenant = $1");
  return Boolean(row?.a);
}

// Registra uma movimentação dentro de uma transação. Quem chama decide o motivo e a referência.
export async function addMove(
  t: Tx,
  m: { productId: string; qty: number; unitCost: number; reason: StockReason; refType?: string; refId?: string; note?: string }
) {
  await t.q(
    `insert into erp_stock_moves (tenant, product_id, qty, unit_cost, reason, ref_type, ref_id, note)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [m.productId, m.qty, m.unitCost, m.reason, m.refType ?? null, m.refId ?? null, m.note ?? ""]
  );
}

// Garante que a saída não deixa o saldo negativo (a menos que a empresa permita).
export async function assertCanRemove(t: Tx, productId: string, qty: number) {
  if (await allowsNegative(t)) return;
  const p = await t.one<{ name: string; track_stock: boolean }>(
    "select name, track_stock from erp_products where tenant = $1 and id = $2",
    [productId]
  );
  if (!p) throw new HttpError(404, "Produto não encontrado.");
  if (!p.track_stock) return;
  const have = await balanceOf(t, productId);
  if (have < qty) {
    throw new HttpError(409, `Estoque insuficiente de "${p.name}": você tem ${have} e precisa de ${qty}.`);
  }
}

// Entrada, saída ou contagem (inventário) feita à mão.
export async function manualMove(tenant: string, input: z.input<typeof stockMoveSchema>) {
  const v = stockMoveSchema.parse(input);
  return tx(tenant, async (t) => {
    const p = await t.one<{ id: string; track_stock: boolean; cost_price: number; name: string }>(
      "select id, track_stock, cost_price::float8 as cost_price, name from erp_products where tenant = $1 and id = $2",
      [v.product_id]
    );
    if (!p) throw new HttpError(404, "Produto não encontrado.");
    if (!p.track_stock) throw new HttpError(409, `"${p.name}" não controla estoque. Ative o controle no cadastro do produto.`);
    const have = await balanceOf(t, p.id);
    let qty = v.qty;
    let reason = v.reason;
    if (v.mode === "count") {
      qty = Math.round((v.qty - have) * 1000) / 1000;
      reason = "adjust";
      if (qty === 0) return { changed: false, balance: have };
    } else if (v.mode === "out") {
      if (v.qty === 0) throw new HttpError(400, "Informe a quantidade.");
      if (reason === "purchase" || reason === "initial") reason = "adjust";
      await assertCanRemove(t, p.id, v.qty);
      qty = -v.qty;
    } else if (v.qty === 0) {
      throw new HttpError(400, "Informe a quantidade.");
    }
    const cost = v.unit_cost ?? p.cost_price;
    await addMove(t, {
      productId: p.id,
      qty,
      unitCost: cost,
      reason,
      note: v.note || (v.mode === "count" ? `Contagem: ${v.qty}` : ""),
    });
    // entrada com custo informado atualiza o custo do produto
    if (qty > 0 && v.unit_cost !== undefined && v.unit_cost > 0) {
      await t.q("update erp_products set cost_price = $2, updated_at = now() where tenant = $1 and id = $3", [v.unit_cost, p.id]);
    }
    return { changed: true, balance: have + qty };
  });
}
