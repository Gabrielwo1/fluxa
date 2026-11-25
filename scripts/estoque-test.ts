// Teste da relação de estoque: vendido por canal, ritmo, cobertura e a baixa das vendas das integrações.
//   DATABASE_URL=postgres://localhost/fluxa_erp npx tsx scripts/estoque-test.ts
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "fs";
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  const m = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m);
  if (m) process.env.DATABASE_URL = m[1].replace(/^["']|["']$/g, "");
}
const T = "teste-estoque";

async function main() {
  const { ensureCompany } = await import("../lib/erp/auth");
  const { q, one } = await import("../lib/erp/db");
  const { ingest } = await import("../lib/erp/services/ingest");
  const { stockRelation, startTracking, statusOf } = await import("../lib/erp/services/stock-relation");
  const stock = await import("../lib/erp/services/stock");
  const products = await import("../lib/erp/services/products");
  const sales = await import("../lib/erp/services/sales");
  for (const t of ["erp_external_refs", "erp_sync_log", "erp_titles", "erp_sales", "erp_stock_moves", "erp_products", "erp_invoices", "erp_parties", "erp_categories", "erp_accounts", "erp_company"]) {
    await q(T, `delete from ${t} where tenant = $1`);
  }
  await ensureCompany(T, "Teste Estoque");
  let step = 0;
  const ok = (m: string) => console.log(`  ✓ ${++step}. ${m}`);
  const day = (n: number) => new Date(Date.now() - 3 * 3600_000 - n * 86_400_000).toISOString().slice(0, 10);
  const order = (source: "loja" | "mercadolivre" | "atendente", id: string, date: string, sku: string, qty: number) =>
    ingest(T, { source, orders: [{ external_id: id, issue_date: date, status: "paid", items: [{ sku, description: `Produto ${sku}`, qty, unit_price: 10 }] }] });

  // --- vendido por canal, ritmo e produto sem controle
  await order("mercadolivre", "m1", day(2), "A", 30);
  await order("loja", "l1", day(5), "A", 20);
  await order("atendente", "w1", day(10), "A", 10);
  await order("mercadolivre", "m2", day(60), "A", 40); // fora dos 30 dias, entra no total
  await order("loja", "l2", day(3), "B", 6);
  let rel = await stockRelation(T, 30);
  const a = rel.rows.find((r) => r.sku === "A")!;
  assert.deepEqual([a.sold_period, a.sold_total], [60, 100]);
  assert.deepEqual(a.by_channel, { mercadolivre: 30, loja: 20, whatsapp: 10, balcao: 0 });
  assert.equal(a.per_day, 2);
  assert.equal(a.status, "sem_controle");
  assert.equal(rel.rows[0].sku, "A"); // mais vendido primeiro
  assert.equal((await stockRelation(T, 7)).rows.find((r) => r.sku === "A")!.sold_period, 50);
  ok("vendido por canal no período e no total, ritmo por dia, produto sem controle e ordem por giro");

  // --- começar a controlar: contagem de hoje; histórico anterior não baixa
  const pa = await one<{ id: string }>(T, "select id from erp_products where tenant = $1 and sku = 'A'");
  await startTracking(T, { product_id: pa!.id, count: 50 });
  await assert.rejects(() => startTracking(T, { product_id: pa!.id, count: 5 }), /já controla/);
  await order("mercadolivre", "m3", day(1), "A", 25); // de ontem: já estava na contagem
  assert.equal((await products.getProduct(T, pa!.id)).stock, 50);
  await order("mercadolivre", "m4", day(0), "A", 20); // de hoje: baixa
  assert.equal((await products.getProduct(T, pa!.id)).stock, 30);
  ok("controle começa na contagem de hoje: venda de ontem não baixa, a de hoje baixa");

  // --- venda de canal nunca é recusada: o saldo fica negativo e o produto pede nova contagem
  const r = await order("mercadolivre", "m5", day(0), "A", 100);
  assert.equal(r.failed, 0, JSON.stringify(r.errors));
  assert.equal((await products.getProduct(T, pa!.id)).stock, -70);
  rel = await stockRelation(T, 30);
  assert.equal(rel.rows.find((x) => x.sku === "A")!.status, "negativo");
  // venda manual continua exigindo saldo
  const c = await (await import("../lib/erp/services/parties")).createParty(T, { name: "Cliente" });
  await assert.rejects(() => sales.createSale(T, { customer_id: c.id, issue_date: day(0), items: [{ product_id: pa!.id, description: "A", qty: 1, unit_price: 10, discount: 0 }], discount: 0, notes: "", payment_method: "", confirm: { method: "", installments: 1, first_due: day(0), interval_days: 30, paid_now: true, account_id: null } }), /Estoque insuficiente/);
  ok("venda de canal deixa o saldo negativo em vez de falhar; venda manual continua exigindo saldo");

  // --- cancelar a venda do canal devolve ao estoque
  await ingest(T, { source: "mercadolivre", orders: [{ external_id: "m5", issue_date: day(0), status: "canceled", items: [{ sku: "A", description: "x", qty: 100, unit_price: 10 }] }] });
  assert.equal((await products.getProduct(T, pa!.id)).stock, 30);
  ok("pedido cancelado no canal devolve o estoque");

  // --- cobertura e sugestão de compra
  await stock.manualMove(T, { product_id: pa!.id, mode: "count", qty: 12, reason: "adjust", note: "" } as never);
  rel = await stockRelation(T, 30);
  const a2 = rel.rows.find((x) => x.sku === "A")!;
  // 30 dias: 60 + 25 + 20 = 105 (m5 cancelada não conta) => 3,5/dia; 12 un duram 3 dias; para 30 dias: 105 - 12 = 93
  assert.deepEqual([a2.sold_period, a2.per_day, a2.cover_days, a2.suggested, a2.status], [105, 3.5, 3, 93, "repor"]);
  ok("cobertura em dias, sugestão para 30 dias e situação 'Repor'");

  assert.equal(statusOf({ track_stock: true, stock: 500, min_stock: 0, sold_period: 0, per_day: 0, cover_days: null }), "sem_giro");
  assert.equal(statusOf({ track_stock: true, stock: 500, min_stock: 0, sold_period: 30, per_day: 1, cover_days: 500 }), "ok");
  assert.equal(statusOf({ track_stock: true, stock: 0, min_stock: 0, sold_period: 0, per_day: 0, cover_days: null }), "zerado");
  ok("situações: parado, em dia e zerado");

  console.log(`\n${step} verificações ok`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
