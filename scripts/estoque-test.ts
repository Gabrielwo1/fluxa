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

  // --- tudo que foi vendido dá saída; sem entrada cadastrada o saldo fica negativo
  await order("mercadolivre", "m1", day(2), "A", 30);
  await order("loja", "l1", day(5), "A", 20);
  await order("atendente", "w1", day(10), "A", 10);
  await order("mercadolivre", "m2", day(60), "A", 40); // fora dos 30 dias, entra no total e na saída
  await order("loja", "l2", day(3), "B", 6);
  let rel = await stockRelation(T, 30);
  const a = rel.rows.find((r) => r.sku === "A")!;
  assert.deepEqual([a.sold_period, a.sold_total], [60, 100]);
  assert.deepEqual(a.by_channel, { mercadolivre: 30, loja: 20, whatsapp: 10, balcao: 0 });
  assert.equal(a.per_day, 2);
  assert.equal(a.track_stock, true);
  assert.equal(a.stock, -100); // 100 saíram e nada entrou
  assert.equal(a.status, "negativo");
  assert.equal(rel.rows.find((r) => r.sku === "B")!.stock, -6);
  assert.equal(rel.rows[0].sku, "A"); // mais vendido primeiro
  assert.equal((await stockRelation(T, 7)).rows.find((r) => r.sku === "A")!.sold_period, 50);
  const pa = await one<{ id: string }>(T, "select id from erp_products where tenant = $1 and sku = 'A'");
  const moves = await q<{ qty: number; d: string }>(T, "select qty::float8 as qty, (created_at at time zone 'America/Sao_Paulo')::date::text as d from erp_stock_moves where tenant = $1 and product_id = $2 order by created_at", [pa!.id]);
  assert.deepEqual(moves.map((m) => [m.qty, m.d]), [[-40, day(60)], [-10, day(10)], [-20, day(5)], [-30, day(2)]]); // cada saída na data da venda
  ok("cada venda dá saída (na data dela) e, sem entrada cadastrada, o saldo fica negativo; vendido por canal e ordem por giro");

  // --- venda de canal nunca é recusada; venda manual continua exigindo saldo
  const r = await order("mercadolivre", "m5", day(0), "A", 100);
  assert.equal(r.failed, 0, JSON.stringify(r.errors));
  assert.equal((await products.getProduct(T, pa!.id)).stock, -200);
  const c = await (await import("../lib/erp/services/parties")).createParty(T, { name: "Cliente" });
  await assert.rejects(() => sales.createSale(T, { customer_id: c.id, issue_date: day(0), items: [{ product_id: pa!.id, description: "A", qty: 1, unit_price: 10, discount: 0 }], discount: 0, notes: "", payment_method: "", confirm: { method: "", installments: 1, first_due: day(0), interval_days: 30, paid_now: true, account_id: null } }), /Estoque insuficiente/);
  ok("venda de canal deixa o saldo mais negativo em vez de falhar; venda manual continua exigindo saldo");

  // --- cancelar a venda do canal devolve a saída
  await ingest(T, { source: "mercadolivre", orders: [{ external_id: "m5", issue_date: day(0), status: "canceled", items: [{ sku: "A", description: "x", qty: 100, unit_price: 10 }] }] });
  assert.equal((await products.getProduct(T, pa!.id)).stock, -100);
  ok("pedido cancelado no canal devolve a saída");

  // --- uma compra/contagem acerta o saldo; cobertura e sugestão
  await stock.manualMove(T, { product_id: pa!.id, mode: "count", qty: 12, reason: "adjust", note: "" } as never);
  rel = await stockRelation(T, 30);
  const a2 = rel.rows.find((x) => x.sku === "A")!;
  // 30 dias: 60 un => 2/dia; 12 un duram 6 dias; para 30 dias: 60 - 12 = 48
  assert.deepEqual([a2.stock, a2.per_day, a2.cover_days, a2.suggested, a2.status], [12, 2, 6, 48, "repor"]);
  // negativo: comprar o rombo mais 30 dias
  assert.equal(rel.rows.find((x) => x.sku === "B")!.suggested, Math.ceil((6 / 30) * 30 + 6));
  ok("contagem acerta o saldo; cobertura, sugestão (inclusive cobrindo o negativo) e situação 'Repor'");

  // --- produto cadastrado à mão sem controle: não baixa; "Controlar" começa numa contagem e só baixa dali em diante
  const manual = await products.createProduct(T, { name: "Manual", sku: "M", track_stock: false, sale_price: 10 });
  await order("loja", "mm1", day(0), "M", 4);
  assert.equal((await products.getProduct(T, manual.id)).stock, 0); // o produto já existia sem controle: nada baixa
  assert.equal((await stockRelation(T, 30)).rows.find((x) => x.sku === "M")!.status, "sem_controle");
  await startTracking(T, { product_id: manual.id, count: 50 });
  await assert.rejects(() => startTracking(T, { product_id: manual.id, count: 5 }), /já controla/);
  await order("loja", "mm2", day(1), "M", 25); // de ontem: já estava na contagem
  assert.equal((await products.getProduct(T, manual.id)).stock, 50);
  await order("loja", "mm3", day(0), "M", 20);
  assert.equal((await products.getProduct(T, manual.id)).stock, 30);
  ok("produto à mão sem controle não baixa; Controlar começa numa contagem e só baixa dali em diante");

  // --- migração 011: produto de integração antigo (sem controle) vira controlado e as vendas já importadas dão saída
  await q(T, "delete from erp_stock_moves where tenant = $1 and product_id = $2", [pa!.id]);
  await q(T, "update erp_products set track_stock = false where tenant = $1 and id = $2", [pa!.id]);
  const { adminQuery } = await import("../lib/erp/db");
  const migration = readFileSync("db/migrations/011_erp_integration_stock.sql", "utf8");
  await adminQuery(migration);
  await adminQuery(migration); // rodar de novo não repete as saídas
  const back = await products.getProduct(T, pa!.id);
  assert.equal(back.track_stock, true);
  assert.equal(back.stock, -100); // as 4 vendas confirmadas (a cancelada não conta)
  assert.equal((await products.getProduct(T, manual.id)).track_stock, true); // já era controlado, intacto
  ok("migração: produto antigo das integrações passa a controlar e as vendas já importadas dão saída, sem repetir");

  assert.equal(statusOf({ track_stock: true, stock: 500, min_stock: 0, sold_period: 0, per_day: 0, cover_days: null }), "sem_giro");
  assert.equal(statusOf({ track_stock: true, stock: 500, min_stock: 0, sold_period: 30, per_day: 1, cover_days: 500 }), "ok");
  assert.equal(statusOf({ track_stock: true, stock: 0, min_stock: 0, sold_period: 0, per_day: 0, cover_days: null }), "zerado");
  ok("situações: parado, em dia e zerado");

  console.log(`\n${step} verificações ok`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
