// Teste das integrações direto no banco (sem HTTP). Usa o tenant "teste-ingest".
//   DATABASE_URL=postgres://localhost/fluxa_erp npx tsx scripts/ingest-test.ts
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "fs";
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  const m = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m);
  if (m) process.env.DATABASE_URL = m[1].replace(/^["']|["']$/g, "");
}
const T = "teste-ingest";
const KEY = "chave-de-teste-com-mais-de-24-caracteres";

async function main() {
  process.env.INGEST_KEY_TESTEINGEST = KEY;
  const { ensureCompany } = await import("../lib/erp/auth");
  const { q, one } = await import("../lib/erp/db");
  const { ingest, overview } = await import("../lib/erp/services/ingest");
  const { ingestTenant } = await import("../lib/erp/ingest-auth");
  const sales = await import("../lib/erp/services/sales");

  for (const t of ["erp_external_refs", "erp_channel_stats", "erp_sync_log", "erp_titles", "erp_sales", "erp_stock_moves", "erp_products", "erp_invoices", "erp_parties", "erp_categories", "erp_accounts", "erp_company"]) {
    await q(T, `delete from ${t} where tenant = $1`);
  }
  await ensureCompany(T, "Teste Ingest");
  let step = 0;
  const ok = (m: string) => console.log(`  ✓ ${++step}. ${m}`);

  // --- chave
  const req = (auth?: string) => new Request("http://x/api/ingest", { headers: auth ? { authorization: auth } : {} });
  assert.equal(ingestTenant(req(`Bearer ${KEY}`)), "testeingest");
  assert.throws(() => ingestTenant(req("Bearer errada-errada-errada-errada-errada")), /inválida/);
  assert.throws(() => ingestTenant(req()), /Bearer/);
  ok("chave: aceita a certa, recusa a errada e a ausente");

  // --- atendente: contatos viram leads; telefone com e sem 55 é o mesmo cliente
  let r = await ingest(T, {
    source: "atendente",
    customers: [
      { external_id: "5511999990001", name: "Ana Souza", phone: "5511999990001", origin: "Anúncio: Protetor", first_contact_at: "2026-11-01T13:00:00Z", lead: true },
      { external_id: "5511999990002", name: "Bruno", phone: "5511999990002", lead: true },
    ],
  });
  assert.deepEqual(r.customers, { created: 2, updated: 0 });
  r = await ingest(T, { source: "atendente", customers: [{ external_id: "5511999990001", name: "Ana S.", phone: "11999990001", email: "ana@x.com", lead: true }] });
  assert.deepEqual(r.customers, { created: 0, updated: 1 });
  const ana = await one<{ name: string; email: string; status: string; source: string; origin: string }>(T, "select name, email, status, source, origin from erp_parties where tenant = $1 and phone like '%999990001'");
  assert.equal(ana?.name, "Ana Souza"); // nome editado/original não é sobrescrito
  assert.equal(ana?.email, "ana@x.com"); // o que faltava é completado
  assert.equal(ana?.status, "lead");
  assert.equal(ana?.origin, "Anúncio: Protetor");
  assert.equal((await q(T, "select 1 from erp_parties where tenant = $1")).length, 2);
  ok("atendente: leads criados, reenvio completa sem duplicar nem sobrescrever");

  // --- venda do WhatsApp: lead vira cliente ativo, entra paga na carteira WhatsApp
  r = await ingest(T, {
    source: "atendente",
    orders: [{ external_id: "wa-1", issue_date: "2026-11-02T15:00:00Z", status: "paid", total: 480, items: [{ description: "Pacote 500 peças", qty: 1, unit_price: 480 }], customer: { external_id: "5511999990001", name: "Ana Souza", phone: "5511999990001" } }],
  });
  assert.equal(r.orders.created, 1, JSON.stringify(r.errors));
  const wa = await one<{ status: string; total: number; channel: string; paid: number }>(T, `select s.status, s.total::float8 as total, s.channel,
     (select coalesce(sum(paid_amount),0) from erp_titles where tenant = s.tenant and origin_id = s.id and status = 'paid')::float8 as paid from erp_sales s where s.tenant = $1`);
  assert.deepEqual(wa, { status: "confirmed", total: 480, channel: "whatsapp", paid: 480 });
  assert.equal((await one<{ status: string }>(T, "select status from erp_parties where tenant = $1 and phone = '5511999990001'"))?.status, "active");
  ok("atendente: venda paga, recebimento na carteira e lead promovido a cliente");

  // --- loja: pedido pago com frete e desconto; total declarado manda; produto novo sem controle de estoque
  const loja = {
    source: "loja" as const,
    orders: [{
      external_id: "1001", number: "#1001", issue_date: "2026-11-05", status: "paid" as const, payment_method: "Pix",
      items: [{ sku: "VEI-500", description: "Protetor 500 un", qty: 2, unit_price: 100 }], shipping: 25, discount: 10, total: 215,
      customer: { external_id: "shop-77", name: "Carla", email: "carla@x.com", document: "529.982.247-25", city: "Campinas", state: "sp" },
    }],
  };
  r = await ingest(T, loja);
  assert.equal(r.orders.created, 1, JSON.stringify(r.errors));
  const l = await one<{ id: string; total: number; subtotal: number; discount: number }>(T, "select id, total::float8 as total, subtotal::float8 as subtotal, discount::float8 as discount from erp_sales where tenant = $1 and channel = 'loja'");
  assert.equal(l?.total, 215);
  const prod = await one<{ track_stock: boolean }>(T, "select track_stock from erp_products where tenant = $1 and sku = 'VEI-500'");
  assert.equal(prod?.track_stock, true);
  const out = await q<{ qty: number }>(T, "select qty::float8 as qty from erp_stock_moves where tenant = $1 and reason = 'sale'");
  assert.deepEqual(out.map((m) => m.qty), [-2]); // a venda de 2 un dá saída: sem entrada cadastrada o saldo fica negativo
  ok("loja: frete vira item, total declarado fecha, produto novo já controla estoque e a venda dá saída");

  // reenvio idêntico: nada muda
  r = await ingest(T, loja);
  assert.deepEqual(r.orders, { created: 0, updated: 0, skipped: 1 });
  assert.equal((await q(T, "select 1 from erp_sales where tenant = $1 and channel = 'loja'")).length, 1);
  assert.equal((await q(T, "select 1 from erp_parties where tenant = $1 and document = '52998224725'")).length, 1);
  ok("loja: reenviar o mesmo pedido não duplica venda nem cliente");

  // --- Mercado Livre: pedido aguardando pagamento vira conta a receber; depois paga; nota fiscal chega junto
  const ml = (status: "pending" | "paid" | "canceled", extra: object = {}) => ({
    source: "mercadolivre" as const,
    orders: [{
      external_id: "200001", issue_date: "2026-11-10T20:00:00Z", status, items: [{ sku: "VEI-250", description: "Protetor 250 un", qty: 1, unit_price: 120 }],
      customer: { external_id: "ml-555", name: "Diego Comprador" }, ...extra,
    }],
  });
  r = await ingest(T, ml("pending"));
  assert.equal(r.orders.created, 1, JSON.stringify(r.errors));
  const open = await one<{ n: number }>(T, "select count(*)::int as n from erp_titles where tenant = $1 and status = 'open' and origin_type = 'sale'");
  assert.equal(open?.n, 1);
  r = await ingest(T, ml("paid", { paid_at: "2026-11-11T12:00:00Z", invoice: { external_id: "inv-9", number: "1234", access_key: "35261100000000000000550010000012341000012345", issue_date: "2026-11-11", amount: 120, customer_name: "Diego Comprador" } }));
  assert.deepEqual([r.orders.updated, r.invoices.created], [1, 1], JSON.stringify(r.errors));
  const t1 = await one<{ status: string; paid_at: string }>(T, "select status, paid_at::text from erp_titles where tenant = $1 and origin_type = 'sale' and status = 'paid' and amount = 120");
  assert.equal(t1?.paid_at, "2026-11-11");
  const inv = await one<{ kind: string; source: string; sale_id: string | null }>(T, "select kind, source, sale_id from erp_invoices where tenant = $1");
  assert.deepEqual([inv?.kind, inv?.source, Boolean(inv?.sale_id)], ["nfe", "integration", true]);
  ok("mercadolivre: pendente vira a receber, pagamento baixa a parcela, NF-e liga ao pedido");

  // reenviar a nota não duplica (mesma chave)
  r = await ingest(T, { source: "mercadolivre", invoices: [{ external_id: "inv-9", number: "1234", access_key: "35261100000000000000550010000012341000012345", issue_date: "2026-11-11", amount: 120, order_external_id: "200001" }] });
  assert.equal(r.invoices.updated, 1);
  assert.equal((await q(T, "select 1 from erp_invoices where tenant = $1")).length, 1);
  ok("mercadolivre: nota reenviada não duplica");

  // cancelamento depois de paga: desfaz o recebimento e cancela
  r = await ingest(T, ml("canceled"));
  assert.equal(r.orders.updated, 1, JSON.stringify(r.errors));
  const c = await one<{ status: string; paid: number }>(T, "select status, (select count(*) from erp_titles where tenant = s.tenant and origin_id = s.id and status = 'paid')::int as paid from erp_sales s where tenant = $1 and channel = 'mercadolivre'");
  assert.deepEqual(c, { status: "canceled", paid: 0 });
  ok("mercadolivre: cancelamento após pagamento desfaz o recebimento");

  // cancelado que nunca existiu entra como cancelado, sem financeiro
  r = await ingest(T, { source: "mercadolivre", orders: [{ external_id: "200002", issue_date: "2026-11-12", status: "canceled", items: [{ description: "Protetor", qty: 1, unit_price: 50 }] }] });
  assert.equal(r.orders.created, 1, JSON.stringify(r.errors));
  ok("pedido que já chega cancelado fica registrado sem financeiro");

  // --- erros de um registro não derrubam os outros
  r = await ingest(T, { source: "loja", orders: [{ external_id: "x1", issue_date: "2026-11-12", status: "paid" }, { external_id: "x2", issue_date: "2026-11-12", status: "paid", items: [{ description: "ok", qty: 1, unit_price: 10 }] }] });
  assert.equal(r.failed, 1);
  assert.equal(r.orders.created, 1);
  assert.match(r.errors[0].message, /sem itens/i);
  await assert.rejects(() => ingest(T, { source: "loja", orders: [{ external_id: "x", issue_date: "2026-11-12", status: "voando" }] } as never), /status/);
  await assert.rejects(() => ingest(T, { source: "outra" } as never), /source/);
  ok("erro em um pedido não impede os outros; formato inválido é recusado com o campo");

  // --- métricas da loja
  r = await ingest(T, { source: "loja", stats: [{ day: "2026-11-20", visitors: 100, sessions: 120, product_views: 80, add_to_cart: 20, checkouts: 8, orders: 3, revenue: 645 }] });
  r = await ingest(T, { source: "loja", stats: [{ day: "2026-11-20", visitors: 110, sessions: 130, product_views: 90, add_to_cart: 22, checkouts: 9, orders: 4, revenue: 700 }] });
  assert.equal(r.stats, 1);
  const st = await q<{ visitors: number }>(T, "select visitors from erp_channel_stats where tenant = $1 and source = 'loja'");
  assert.deepEqual(st, [{ visitors: 110 }]);
  ok("métricas: um dia reenviado sobrescreve, não soma");

  // --- visão geral
  const ov = await overview(T);
  const byS = Object.fromEntries(ov.map((o) => [o.source, o]));
  assert.equal(byS.loja.sales, 2);
  assert.equal(byS.atendente.revenue, 480);
  assert.equal(byS.mercadolivre.invoices, 1);
  assert.ok(byS.loja.recent.length > 0 && byS.loja.last_sync);
  ok("visão geral: vendas, receita, notas e histórico de envios por canal");

  // --- cancelar pelo ERP continua funcionando em venda vinda de fora
  const lojaSale = await one<{ id: string }>(T, "select id from erp_sales where tenant = $1 and channel = 'loja' and total = 215");
  const cancelled = await sales.cancelSale(T, lojaSale!.id).catch((e) => e);
  assert.match(String(cancelled.message), /recebidas/);
  ok("regras do ERP continuam valendo (venda com parcela recebida exige desfazer a baixa)");

  console.log(`\n${step} verificações ok`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
