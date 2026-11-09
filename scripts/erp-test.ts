// Teste de ponta a ponta das regras do ERP direto no banco (sem HTTP). Usa o tenant "teste-erp".
//   DATABASE_URL=postgres://localhost/fluxa_erp npx tsx scripts/erp-test.ts
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "fs";
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  const m = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m);
  if (m) process.env.DATABASE_URL = m[1].replace(/^["']|["']$/g, "");
}
const T = "teste-erp";

async function main() {
  const { ensureCompany } = await import("../lib/erp/auth");
  const { q, one } = await import("../lib/erp/db");
  const parties = await import("../lib/erp/services/parties");
  const products = await import("../lib/erp/services/products");
  const stock = await import("../lib/erp/services/stock");
  const sales = await import("../lib/erp/services/sales");
  const purchases = await import("../lib/erp/services/purchases");
  const fin = await import("../lib/erp/services/finance");
  const rep = await import("../lib/erp/services/reports");
  const dash = await import("../lib/erp/services/dashboard");
  const demo = await import("../lib/erp/services/demo");
  const company = await import("../lib/erp/services/company");

  // limpa o tenant de teste
  for (const t of ["erp_titles", "erp_recurring", "erp_sales", "erp_purchases", "erp_stock_moves", "erp_products", "erp_parties", "erp_categories", "erp_accounts", "erp_company"]) {
    await q(T, `delete from ${t} where tenant = $1`);
  }
  await ensureCompany(T, "Empresa Teste");
  let step = 0;
  const ok = (msg: string) => console.log(`  ✓ ${++step}. ${msg}`);

  // --- isolamento: SQL sem tenant é rejeitado
  await assert.rejects(() => q(T, "select * from erp_parties"), /sem filtro de tenant/);
  ok("consulta sem tenant é rejeitada");

  // --- cadastros
  const c1 = await parties.createParty(T, { name: "Maria Cliente", document: "529.982.247-25", is_customer: true });
  await assert.rejects(() => parties.createParty(T, { name: "Outra", document: "52998224725" }), /Já existe/);
  await assert.rejects(() => parties.createParty(T, { name: "Inválido", document: "111.111.111-11" }), /inválido/);
  const sup = await parties.createParty(T, { name: "Fornecedor X", is_customer: false, is_supplier: true });
  ok("clientes e fornecedores: validação de CPF e duplicidade");

  const prod = await products.createProduct(T, { name: "Camiseta", sku: "CAM-1", cost_price: 20, sale_price: 50, initial_stock: 10, min_stock: 3 });
  assert.equal(prod.stock, 10);
  const svc = await products.createProduct(T, { name: "Consultoria", kind: "service", sale_price: 200 });
  assert.equal(svc.track_stock, false);
  await assert.rejects(() => products.createProduct(T, { name: "Dup", sku: "cam-1" }), /Já existe/);
  ok("produtos: estoque inicial, serviço sem estoque, SKU único");

  // --- venda a prazo com estoque
  const sale = await sales.createSale(T, {
    customer_id: c1.id, issue_date: "2026-10-01", notes: "", payment_method: "", discount: 10,
    items: [
      { product_id: prod.id, description: "Camiseta", qty: 4, unit_price: 50, discount: 0 },
      { product_id: svc.id, description: "Consultoria", qty: 1, unit_price: 200, discount: 20 },
    ],
    confirm: { method: "Boleto", installments: 3, first_due: "2026-10-31", interval_days: 30, paid_now: false, account_id: null },
  });
  assert.equal(sale.status, "confirmed");
  assert.equal(sale.number, 1);
  assert.equal(sale.subtotal, 380);
  assert.equal(sale.total, 370);
  assert.equal(sale.titles?.length, 3);
  assert.deepEqual(sale.titles?.map((t) => t.amount), [123.34, 123.33, 123.33]);
  assert.equal(sale.titles?.reduce((s, t) => s + t.amount, 0).toFixed(2), "370.00");
  assert.equal((await products.getProduct(T, prod.id)).stock, 6);
  assert.equal(sale.items?.[0].unit_cost, 20);
  ok("venda confirmada: total, 3 parcelas (centavos), baixa de estoque e custo guardado");

  // estoque insuficiente
  await assert.rejects(
    () => sales.createSale(T, { customer_id: c1.id, issue_date: "2026-10-02", notes: "", payment_method: "", discount: 0,
      items: [{ product_id: prod.id, description: "Camiseta", qty: 7, unit_price: 50, discount: 0 }],
      confirm: { method: "Pix", installments: 1, first_due: "2026-10-02", interval_days: 30, paid_now: true, account_id: null } }),
    /Estoque insuficiente/
  );
  assert.equal((await products.getProduct(T, prod.id)).stock, 6, "falha não pode mexer no estoque");
  const nextNum = await one<{ n: number }>(T, "select next_sale_number as n from erp_company where tenant = $1");
  assert.equal(nextNum?.n, 2, "número da venda não é consumido numa falha");
  ok("estoque insuficiente bloqueia a venda e desfaz tudo (transação)");

  // venda a prazo sem cliente
  await assert.rejects(
    () => sales.createSale(T, { customer_id: null, issue_date: "2026-10-02", notes: "", payment_method: "", discount: 0,
      items: [{ product_id: svc.id, description: "Consultoria", qty: 1, unit_price: 200, discount: 0 }],
      confirm: { method: "Boleto", installments: 1, first_due: "2026-11-02", interval_days: 30, paid_now: false, account_id: null } }),
    /escolha o cliente/
  );
  ok("venda a prazo exige cliente");

  // recebimento e cancelamento
  const accounts = await fin.listAccounts(T);
  const caixa = accounts.find((a) => a.kind === "cash")!;
  const t1 = sale.titles![0];
  await fin.payTitle(T, t1.id, { paid_at: "2026-10-31", paid_amount: t1.amount, account_id: caixa.id });
  assert.equal((await fin.listAccounts(T)).find((a) => a.id === caixa.id)!.balance, 123.34);
  await assert.rejects(() => sales.cancelSale(T, sale.id), /já recebidas/);
  await fin.unpayTitle(T, t1.id);
  const canceled = await sales.cancelSale(T, sale.id);
  assert.equal(canceled.status, "canceled");
  assert.equal((await products.getProduct(T, prod.id)).stock, 10, "cancelar devolve o estoque");
  assert.equal((await fin.listTitles(T, { direction: "in", status: "all" })).length, 0, "parcelas canceladas somem da lista");
  ok("baixa soma no caixa; cancelar exige estorno, devolve estoque e cancela parcelas");

  // --- compra
  const pur = await purchases.createPurchase(T, {
    supplier_id: sup.id, issue_date: "2026-10-03", notes: "", payment_method: "", discount: 0,
    items: [{ product_id: prod.id, description: "Camiseta", qty: 20, unit_cost: 25 }],
    receive: { method: "Boleto", installments: 2, first_due: "2026-10-20", interval_days: 30, paid_now: false, account_id: null },
  });
  assert.equal(pur.status, "received");
  assert.equal((await products.getProduct(T, prod.id)).stock, 30);
  assert.equal((await products.getProduct(T, prod.id)).cost_price, 25);
  assert.equal(pur.titles?.length, 2);
  assert.equal(pur.titles?.[0].direction, "out");
  ok("compra recebida: entrada no estoque, custo atualizado, contas a pagar");
  await purchases.cancelPurchase(T, pur.id);
  assert.equal((await products.getProduct(T, prod.id)).stock, 10);
  ok("cancelar compra reverte estoque");

  // --- ajustes manuais
  await assert.rejects(() => stock.manualMove(T, { product_id: prod.id, mode: "out", qty: 99, reason: "loss" }), /insuficiente/);
  await stock.manualMove(T, { product_id: prod.id, mode: "count", qty: 12 });
  assert.equal((await products.getProduct(T, prod.id)).stock, 12);
  await stock.manualMove(T, { product_id: prod.id, mode: "out", qty: 2, reason: "loss", note: "quebra" });
  assert.equal((await products.getProduct(T, prod.id)).stock, 10);
  await assert.rejects(() => stock.manualMove(T, { product_id: svc.id, mode: "in", qty: 1 }), /não controla estoque/);
  ok("estoque: contagem, perda e bloqueio de saldo negativo");

  // --- financeiro manual e recorrência
  const cats = await fin.listCategories(T);
  const rent = cats.find((c) => c.name === "Aluguel")!;
  const manual = await fin.createTitles(T, { direction: "out", description: "Equipamento", amount: 100, due_date: "2026-01-31", installments: 3, category_id: rent.id, party_id: null, notes: "", paid_now: false, account_id: null });
  assert.deepEqual(manual.map((t) => t.due_date), ["2026-01-31", "2026-02-28", "2026-03-31"], "fim de mês respeitado");
  assert.deepEqual(manual.map((t) => t.amount), [33.34, 33.33, 33.33]);
  const rec = await fin.createRecurring(T, { direction: "out", description: "Aluguel", category_id: rent.id, party_id: null, amount: 1500, day: 31, active: true });
  assert.equal(rec.generated_this_month, false);
  const g1 = await fin.generateRecurring(T, "2026-02");
  const g2 = await fin.generateRecurring(T, "2026-02");
  assert.equal(g1.created, 1);
  assert.equal(g2.created, 0, "gerar de novo não duplica");
  const feb = (await fin.listTitles(T, { direction: "out", from: "2026-02-01", to: "2026-02-28" })).find((t) => t.description === "Aluguel");
  assert.equal(feb?.due_date, "2026-02-28");
  await fin.cancelTitle(T, manual[0].id);
  await assert.rejects(() => fin.cancelTitle(T, sale.titles![0].id), /Não encontrado|não encontrado|pertence/i);
  ok("lançamentos: parcelas mensais, recorrência sem duplicar, dia 31 em fevereiro");

  // --- fluxo de caixa
  const cf = await fin.cashflow(T, 30);
  assert.equal(cf.series.length, 31);
  assert.equal(cf.series[cf.series.length - 1].balance, cf.closing);
  assert.ok(Math.abs(cf.opening + cf.total_in - cf.total_out - cf.closing) < 0.01, "saldo final = saldo + entradas - saídas");
  ok("fluxo de caixa fecha a conta (abertura + entradas − saídas = fechamento)");

  // --- demo, relatórios, painel
  await demo.loadDemo(T);
  const d = await dash.getDashboard(T);
  assert.ok(d.sales.total > 0 && d.series.length === 6 && d.top_customers.length > 0);
  assert.ok(d.receivable.overdue_count >= 2, "demo traz parcelas atrasadas");
  const stockRows = await products.listProducts(T, {});
  assert.ok(stockRows.every((p) => !p.track_stock || (p.stock ?? 0) >= 0), "estoque nunca negativo");
  for (const r of rep.REPORTS) {
    const out = await rep.runReport(T, r.name, { from: "2026-05-01", to: "2026-12-31" });
    assert.ok(out.columns.length > 0, r.name);
  }
  const dre = await rep.runReport(T, "dre", { from: "2026-05-01", to: "2026-12-31" });
  assert.ok(dre.rows.length >= 3);
  ok(`demo carregada; painel e ${rep.REPORTS.length} relatórios rodam`);
  await assert.rejects(() => demo.loadDemo(T), /já foram carregados/);
  await demo.removeDemo(T);
  const left = await one<{ n: number }>(T, "select (select count(*) from erp_parties where tenant = $1 and demo) + (select count(*) from erp_sales where tenant = $1 and demo) + (select count(*) from erp_products where tenant = $1 and demo) as n");
  assert.equal(Number(left?.n), 0);
  assert.equal((await parties.listParties(T, {})).some((p) => p.name === "Maria Cliente"), true, "dados reais sobrevivem à limpeza dos exemplos");
  assert.equal((await company.getCompany(T)).has_demo, false);
  ok("remover exemplos apaga só os exemplos");

  // --- isolamento entre empresas
  await ensureCompany("outra-empresa", "Outra");
  assert.equal((await parties.listParties("outra-empresa", {})).length, 0);
  await assert.rejects(() => parties.getParty("outra-empresa", c1.id), /não encontrado/);
  await assert.rejects(() => products.getProduct("outra-empresa", prod.id), /não encontrado/);
  ok("empresa B não enxerga nada da empresa A");
  for (const t of ["erp_titles", "erp_recurring", "erp_sales", "erp_purchases", "erp_stock_moves", "erp_products", "erp_parties", "erp_categories", "erp_accounts", "erp_company"]) {
    await q("outra-empresa", `delete from ${t} where tenant = $1`);
  }
  console.log("\nTudo certo.");
  process.exit(0);
}
main().catch((e) => { console.error("\nFALHOU:", e); process.exit(1); });
