// Teste da conciliação: cruzamento banco x ERP e pontos onde as curvas se encontram. Tenant "teste-conc".
//   DATABASE_URL=postgres://localhost/fluxa_erp npx tsx scripts/conciliacao-test.ts
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "fs";
import { crossings, cumulative, daysInRange, reconcile, type BankCredit, type OpenTitle, type ReceivedTitle } from "../lib/erp/reconcile";
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  const m = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m);
  if (m) process.env.DATABASE_URL = m[1].replace(/^["']|["']$/g, "");
}
const T = "teste-conc";
let step = 0;
const ok = (m: string) => console.log(`  ✓ ${++step}. ${m}`);

const credit = (id: string, date: string, amount: number): BankCredit => ({ id, date, amount, description: id, account: "Banco" });
const paid = (id: string, paid_at: string, amount: number): ReceivedTitle => ({ id, description: id, amount, paid_at });
const open = (id: string, due_date: string, amount: number): OpenTitle => ({ id, description: id, party: null, amount, due_date, sale_number: null });

async function main() {
  // --- pareamento
  const r = reconcile(
    [credit("c1", "2026-11-10", 100), credit("c2", "2026-11-11", 250), credit("c3", "2026-11-12", 80), credit("c4", "2026-11-12", 100)],
    [paid("p1", "2026-11-10", 100), paid("p2", "2026-11-01", 999)],
    [open("o1", "2026-11-11", 250), open("o2", "2026-11-12", 100)]
  );
  assert.deepEqual(r.matched.map((m) => [m.credit.id, m.title.id]), [["c1", "p1"]]);
  assert.deepEqual(r.suggestions.map((s) => [s.credit.id, s.title.id]), [["c2", "o1"], ["c4", "o2"]]);
  assert.deepEqual(r.orphans.map((c) => c.id), ["c3"]);
  assert.deepEqual(r.paidWithoutBank.map((t) => t.id), ["p2"]);
  ok("entrada com baixa, entrada que bate com conta em aberto, entrada sem venda e baixa sem extrato");

  // mesmo valor duas vezes: cada entrada casa com uma conta, nunca duas com a mesma
  const dup = reconcile([credit("a", "2026-11-10", 50), credit("b", "2026-11-20", 50)], [], [open("x", "2026-11-10", 50)]);
  assert.equal(dup.suggestions.length, 1);
  assert.equal(dup.suggestions[0].credit.id, "a"); // a mais próxima do vencimento
  assert.equal(dup.orphans.length, 1);
  ok("duas entradas iguais para uma conta: fica com a mais próxima, a outra é órfã");

  // fora da janela não casa
  const far = reconcile([credit("a", "2026-11-10", 50)], [paid("p", "2026-10-01", 50)], [open("x", "2027-03-10", 50)]);
  assert.equal(far.matched.length + far.suggestions.length, 0);
  ok("data muito distante não casa");

  // --- cruzamento das curvas
  const days = daysInRange("2026-11-01", "2026-11-06");
  assert.equal(days.length, 6);
  const sales = { key: "s", label: "Vendas", values: cumulative([0, 100, 100, 100, 0, 0]) };
  const bank = { key: "b", label: "Banco", values: cumulative([0, 0, 50, 100, 150, 100]) };
  // vendas 0,100,200,300,300,300 ; banco 0,0,50,150,300,400
  const x = crossings(sales, bank);
  assert.equal(x.length, 1);
  assert.equal(x[0].up, "Banco");
  assert.equal(x[0].down, "Vendas");
  assert.deepEqual([x[0].index, x[0].t, x[0].value], [4, 0, 300]); // as linhas se tocam no dia 5 (300 = 300) e o banco segue em frente
  ok("o banco passa as vendas: um cruzamento, com quem passou quem");

  // empate no início não é cruzamento; troca de lado duas vezes dá dois
  const a = { key: "a", label: "A", values: [0, 0, 5, 10, 8, 20] };
  const b = { key: "b", label: "B", values: [0, 0, 8, 7, 12, 15] };
  assert.equal(crossings(a, b).length, 3);
  assert.equal(crossings({ ...a, values: [0, 0, 0] }, { ...b, values: [0, 0, 0] }).length, 0);
  ok("empate em zero não conta; cada troca de lado conta");

  // --- serviço (banco local)
  const { ensureCompany } = await import("../lib/erp/auth");
  const { q } = await import("../lib/erp/db");
  const sales_ = await import("../lib/erp/services/sales");
  const parties = await import("../lib/erp/services/parties");
  const { conciliation, settleFromBank } = await import("../lib/erp/services/conciliation");
  for (const t of ["erp_titles", "erp_sales", "erp_stock_moves", "erp_products", "erp_invoices", "erp_parties", "erp_categories", "erp_accounts", "erp_company"]) {
    await q(T, `delete from ${t} where tenant = $1`);
  }
  await ensureCompany(T, "Teste Conc");
  const c = await parties.createParty(T, { name: "Cliente" });
  const mk = (date: string, total: number, paidNow: boolean) =>
    sales_.createSale(T, {
      customer_id: c.id, issue_date: date, items: [{ description: "Item", qty: 1, unit_price: total }], discount: 0, notes: "", payment_method: "",
      confirm: { method: "Pix", installments: 1, first_due: date, interval_days: 30, paid_now: paidNow, account_id: null },
    });
  const s1 = await mk("2026-11-02", 100, true);
  const s2 = await mk("2026-11-02", 200, false);
  await mk("2026-11-05", 300, false);
  await q(T, `insert into erp_invoices (tenant, sale_id, number, issue_date, amount, source) values ($1, $2, '1', '2026-11-03', 100, 'integration')`, [s1.id]);
  await q(T, `insert into erp_invoices (tenant, number, issue_date, amount, source) values ($1, '2', '2026-11-04', 50, 'integration')`);

  const d = await conciliation(T, "2026-11-01", "2026-11-06");
  assert.equal(d.days.length, 6);
  assert.deepEqual(d.days.map((x) => x.date), daysInRange("2026-11-01", "2026-11-06")); // AAAA-MM-DD, sem hora nem fuso
  assert.deepEqual(d.days.map((x) => x.sales), [0, 300, 0, 0, 300, 0]);
  assert.deepEqual(d.days.map((x) => x.invoices), [0, 0, 100, 50, 0, 0]);
  assert.equal(d.received.length, 1);
  assert.equal(d.open.length, 2);
  assert.deepEqual(d.sales_without_invoice.map((s) => s.total).sort(), [200, 300]);
  assert.deepEqual(d.invoices_without_sale.map((i) => i.amount), [50]);
  ok("serviço: vendas e notas por dia, recebidos, em aberto, venda sem nota e nota sem venda");

  // confirmar sugestão dá a baixa com a data do extrato
  const title = d.open.find((t) => t.amount === 200)!;
  await settleFromBank(T, { title_id: title.id, paid_at: "2026-11-04T00:00:00.000Z", amount: 200 });
  const after = await conciliation(T, "2026-11-01", "2026-11-06");
  assert.equal(after.open.length, 1);
  assert.deepEqual(after.received.map((t) => [t.amount, t.paid_at]).sort(), [[100, "2026-11-02"], [200, "2026-11-04"]]);
  await assert.rejects(() => settleFromBank(T, { title_id: title.id, paid_at: "2026-11-04", amount: 200 }), /já foi pago/);
  await assert.rejects(() => conciliation(T, "2026-11-09", "2026-11-01"), /Período/);
  void s2;
  ok("confirmar a sugestão baixa a conta com a data do extrato; baixa repetida e período inválido são recusados");

  console.log(`\n${step} verificações ok`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
