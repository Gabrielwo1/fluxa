import { z } from "zod";
import { HttpError } from "@/lib/tenant";
import { one, q, tx } from "@/lib/erp/db";
import { productSchema } from "@/lib/erp/schemas";
import type { Product } from "@/lib/erp/types";

const STOCK = `coalesce((select sum(m.qty) from erp_stock_moves m where m.tenant = p.tenant and m.product_id = p.id), 0)::float8`;

const COLS = `p.id, p.sku, p.name, p.kind, p.unit, p.category, p.cost_price::float8 as cost_price,
  p.sale_price::float8 as sale_price, p.track_stock, p.min_stock::float8 as min_stock, p.active, p.notes, p.demo`;

export type ProductFilter = { q?: string; kind?: string; active?: string; low?: boolean; limit?: number };

export async function listProducts(tenant: string, f: ProductFilter = {}): Promise<Product[]> {
  const where = ["p.tenant = $1"];
  const params: unknown[] = [];
  if (f.q?.trim()) {
    params.push(`%${f.q.trim().toLowerCase()}%`);
    where.push(`(lower(p.name) like $${params.length + 1} or lower(p.sku) like $${params.length + 1} or lower(p.category) like $${params.length + 1})`);
  }
  if (f.kind === "product" || f.kind === "service") {
    params.push(f.kind);
    where.push(`p.kind = $${params.length + 1}`);
  }
  if (f.active === "true") where.push("p.active");
  if (f.active === "false") where.push("not p.active");
  if (f.low) where.push(`p.track_stock and p.active and ${STOCK} <= p.min_stock`);
  params.push(Math.min(f.limit ?? 1000, 2000));
  return q<Product>(
    tenant,
    `select ${COLS}, ${STOCK} as stock from erp_products p
      where ${where.join(" and ")} order by lower(p.name) limit $${params.length + 1}`,
    params
  );
}

export async function getProduct(tenant: string, id: string): Promise<Product> {
  const row = await one<Product>(
    tenant,
    `select ${COLS}, ${STOCK} as stock from erp_products p where p.tenant = $1 and p.id = $2`,
    [id]
  );
  if (!row) throw new HttpError(404, "Produto não encontrado.");
  return row;
}

const skuTaken = (e: unknown) =>
  (e as { code?: string; constraint?: string })?.constraint === "erp_products_tenant_sku_uq"
    ? new HttpError(409, "Já existe um produto com este código (SKU).")
    : e;

export async function createProduct(tenant: string, input: z.input<typeof productSchema>): Promise<Product> {
  const v = productSchema.parse(input);
  const trackStock = v.kind === "service" ? false : v.track_stock;
  const id = await tx(tenant, async (t) => {
    const [row] = await t.q<{ id: string }>(
      `insert into erp_products (tenant, sku, name, kind, unit, category, cost_price, sale_price, track_stock, min_stock, active, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
      [v.sku, v.name, v.kind, v.unit, v.category, v.cost_price, v.sale_price, trackStock, trackStock ? v.min_stock : 0, v.active, v.notes]
    );
    if (trackStock && v.initial_stock > 0) {
      await t.q(
        `insert into erp_stock_moves (tenant, product_id, qty, unit_cost, reason, note)
         values ($1,$2,$3,$4,'initial','Estoque inicial')`,
        [row.id, v.initial_stock, v.cost_price]
      );
    }
    return row.id;
  }).catch((e) => {
    throw skuTaken(e);
  });
  return getProduct(tenant, id);
}

export async function updateProduct(tenant: string, id: string, input: z.input<typeof productSchema>): Promise<Product> {
  const v = productSchema.parse(input);
  const trackStock = v.kind === "service" ? false : v.track_stock;
  const rows = await q(
    tenant,
    `update erp_products set sku=$3, name=$4, kind=$5, unit=$6, category=$7, cost_price=$8, sale_price=$9,
       track_stock=$10, min_stock=$11, active=$12, notes=$13, updated_at=now()
     where tenant = $1 and id = $2 returning id`,
    [id, v.sku, v.name, v.kind, v.unit, v.category, v.cost_price, v.sale_price, trackStock, trackStock ? v.min_stock : 0, v.active, v.notes]
  ).catch((e) => {
    throw skuTaken(e);
  });
  if (rows.length === 0) throw new HttpError(404, "Produto não encontrado.");
  return getProduct(tenant, id);
}

// Produto que já foi vendido, comprado ou movimentado fica no histórico: inative em vez de excluir.
export async function deleteProduct(tenant: string, id: string): Promise<void> {
  const used = await one<{ n: number }>(
    tenant,
    `select (
       (select count(*) from erp_sale_items i join erp_sales s on s.id = i.sale_id where s.tenant = $1 and i.product_id = $2) +
       (select count(*) from erp_purchase_items i join erp_purchases s on s.id = i.purchase_id where s.tenant = $1 and i.product_id = $2) +
       (select count(*) from erp_stock_moves where tenant = $1 and product_id = $2 and reason <> 'initial')
     )::int as n`,
    [id]
  );
  if (used && used.n > 0) throw new HttpError(409, "Este produto já foi movimentado. Inative em vez de excluir.");
  const rows = await q(tenant, "delete from erp_products where tenant = $1 and id = $2 returning id", [id]);
  if (rows.length === 0) throw new HttpError(404, "Produto não encontrado.");
}
