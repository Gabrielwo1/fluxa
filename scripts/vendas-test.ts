// Teste dos totais e da paginação de Vendas: os números do topo têm que ser do período inteiro, não das linhas carregadas.
//   DATABASE_URL=postgres://localhost/fluxa_erp npx tsx scripts/vendas-test.ts
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "fs";
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  const m = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m);
  if (m) process.env.DATABASE_URL = m[1].replace(/^["']|["']$/g, "");
}
const T = "teste-vendas";

async function main() {
  const { ensureCompany } = await import("../lib/erp/auth");
  const { q } = await import("../lib/erp/db");
  const sales = await import("../lib/erp/services/sales");
  for (const t of ["erp_titles", "erp_sales", "erp_stock_moves", "erp_products", "erp_parties", "erp_categories", "erp_accounts", "erp_company"]) {
    await q(T, `delete from ${t} where tenant = $1`);
  }
  await ensureCompany(T, "Teste Vendas");
  let step = 0;
  const ok = (m: string) => console.log(`  ✓ ${++step}. ${m}`);

  const day = (n: number) => new Date(Date.now() - 3 * 3600_000 - n * 86_400_000).toISOString().slice(0, 10);
  const mk = (date: string, total: number, confirm: boolean) =>
    sales.createSale(T, {
      customer_id: null, issue_date: date, items: [{ description: "Item", qty: 1, unit_price: total }], discount: 0, notes: "", payment_method: "",
      confirm: confirm ? { method: "Pix", installments: 1, first_due: date, interval_days: 30, paid_now: true, account_id: null } : undefined,
    });
  // 130 vendas confirmadas de R$ 10 nos últimos 5 dias, 4 orçamentos de R$ 50 e uma venda velha (100 dias atrás)
  for (let i = 0; i < 130; i++) await mk(day(i % 5), 10, true);
  for (let i = 0; i < 4; i++) await mk(day(1), 50, false);
  await mk(day(100), 999, true);

  const from = day(10);
  const page = await sales.listSales(T, { from, to: day(0) });
  const sum = await sales.salesSummary(T, { from, to: day(0) });
  assert.equal(page.length, 100); // a lista vem paginada
  assert.equal(sum.total, 134);
  assert.equal(sum.confirmed_count, 130);
  assert.equal(sum.revenue, 1300); // dos 130, não dos 100 carregados
  assert.deepEqual([sum.quotes_count, sum.quotes_value], [4, 200]);
  ok("a lista vem em 100, mas faturamento e contagens são do período inteiro (130 vendas)");

  const more = await sales.listSales(T, { from, to: day(0), limit: 300 });
  assert.equal(more.length, 134);
  ok("pedir mais traz o resto");

  const old = await sales.salesSummary(T, {});
  assert.equal(old.revenue, 1300 + 999);
  const onlyQuotes = await sales.listSales(T, { from, to: day(0), status: "quote" });
  assert.equal(onlyQuotes.length, 4);
  const sumQuotes = await sales.salesSummary(T, { from, to: day(0), status: "quote" });
  assert.equal(sumQuotes.revenue, 1300); // o filtro de situação não zera os totais do topo
  ok("sem período pega tudo; o filtro de situação muda a lista e não os totais do topo");

  // a receber: venda a prazo entra em "a receber" e em "atrasado" quando venceu
  await sales.createSale(T, {
    customer_id: null, issue_date: day(40), items: [{ description: "A prazo", qty: 1, unit_price: 70 }], discount: 0, notes: "", payment_method: "",
    confirm: { method: "Boleto", installments: 1, first_due: day(30), interval_days: 30, paid_now: false, account_id: null },
  }).catch((e) => assert.match(String(e.message), /cliente/)); // sem cliente só dá para receber na hora
  const { createParty } = await import("../lib/erp/services/parties");
  const c = await createParty(T, { name: "Cliente" });
  await sales.createSale(T, {
    customer_id: c.id, issue_date: day(40), items: [{ description: "A prazo", qty: 1, unit_price: 70 }], discount: 0, notes: "", payment_method: "",
    confirm: { method: "Boleto", installments: 1, first_due: day(30), interval_days: 30, paid_now: false, account_id: null },
  });
  const late = await sales.salesSummary(T, { from: day(45), to: day(35) });
  assert.deepEqual([late.open, late.overdue], [70, 70]);
  const none = await sales.salesSummary(T, { from, to: day(0) });
  assert.deepEqual([none.open, none.overdue], [0, 0]);
  ok("a receber e atrasado só contam as vendas do período");

  console.log(`\n${step} verificações ok`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
