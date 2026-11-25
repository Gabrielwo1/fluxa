// Teste da sincronização automática: servidores falsos do atendente (com Mercado Livre), da Shopify e do
// banco de acessos da loja, e o banco local do ERP. Usa o tenant "teste-sync".
//   DATABASE_URL=postgres://localhost/fluxa_erp npx tsx scripts/sync-test.ts
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync, existsSync } from "fs";
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  const m = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m);
  if (m) process.env.DATABASE_URL = m[1].replace(/^["']|["']$/g, "");
}
const T = "teste-sync";
const day = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const back = (n: number) => new Date(Date.parse(`${day}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
const iso = (d = day) => `${d}T15:00:00.000-03:00`;

// ---- estado do mundo falso
const world = {
  loginOk: true,
  mlStatus: "paid" as "paid" | "payment_required",
  shopifyStatus: "PAID",
  shopifyCancelled: null as string | null,
  denyPii: false,
  calls: { billing: 0, invoice: 0 },
};
const body = (req: http.IncomingMessage) => new Promise<string>((r) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => r(d)); });
const send = (res: http.ServerResponse, data: unknown, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url!, "http://x");
  const raw = await body(req);
  // atendente
  if (u.pathname === "/api/login") return world.loginOk && JSON.parse(raw).code === "codigo-certo" ? send(res, { token: "tok" }) : send(res, { error: "Código inválido." }, 401);
  if (u.pathname.startsWith("/api/") && req.headers.authorization !== "Bearer tok") return send(res, { error: "unauthorized" }, 401);
  if (u.pathname === "/api/contacts") return send(res, {
    contacts: [
      { wa_id: "5546999110001", name: "Marcos Lima", source: "whatsapp", first_seen_at: iso(), ad_source_id: "1", ad_headline: "Protetor", customer_info: { endereco: "Rua B, 20", observacoes: "Cliente fiel" }, sales: [{ id: 7 }] },
      { wa_id: "5546999110002", name: "Joana", source: "whatsapp", first_seen_at: iso(), ad_source_id: null, ad_headline: null, customer_info: {}, sales: [] },
    ],
    sales: [{ id: 7, wa_id: "5546999110001", amount: 480, sold_at: iso(), origin: "trafego", contacts: { name: "Marcos Lima" } }],
  });
  if (u.pathname === "/api/mercadolivre") {
    if (u.searchParams.get("r") === "status") return send(res, { account: { ml_user_id: 99 } });
    const path = u.searchParams.get("path")!;
    if (path.startsWith("/orders/search")) return send(res, { path, data: { paging: { total: 1 }, results: [{
      id: 5001, date_created: iso(), status: world.mlStatus, total_amount: 120, paid_amount: 138.9, buyer: { id: 11, nickname: "COMPRADOR1" }, shipping: { id: 77 },
      order_items: [{ item: { id: "MLB1", title: "Protetor 250 un", seller_sku: "VEI-250" }, quantity: 1, unit_price: 120 }],
      payments: [{ status: "approved", payment_method_id: "pix", date_approved: iso() }] }] } });
    if (path.includes("/billing_info")) { world.calls.billing++; return send(res, { path, data: { billing_info: { name: "Fulano", last_name: "de Tal", doc_number: "52998224725" } } }); }
    if (path.startsWith("/shipments/")) return send(res, { path, data: { receiver_address: { zip_code: "86010000", city: { name: "Londrina" }, state: { id: "BR-PR" } } } });
    if (path.includes("/invoices/orders/")) { world.calls.invoice++; return send(res, { path, data: { id: 880, invoice_number: 4321, status: "authorized", amount: 138.9, issued_date: iso(), attributes: { invoice_key: "35261100000000000000550010000043211000043210" } } }); }
  }
  // Shopify
  if (u.pathname === "/admin/oauth/access_token") return send(res, { access_token: "shpat", expires_in: 86400 });
  if (u.pathname.endsWith("/graphql.json")) {
    const { query } = JSON.parse(raw);
    if (world.denyPii && query.includes("customer {")) return send(res, { errors: [{ message: "Access denied for customer field", extensions: { code: "ACCESS_DENIED" } }] });
    const pii = query.includes("customer {");
    return send(res, { data: { orders: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [{
      id: "gid://shopify/Order/9001", name: "#1001", createdAt: iso(), cancelledAt: world.shopifyCancelled, displayFinancialStatus: world.shopifyStatus, note: null,
      paymentGatewayNames: ["pix"], totalPriceSet: { shopMoney: { amount: "225.00" } }, totalShippingPriceSet: { shopMoney: { amount: "25.00" } },
      ...(pii ? { email: "carla@x.com", phone: null, customer: { id: "gid://shopify/Customer/5", firstName: "Carla", lastName: "Mendes", email: "carla@x.com", phone: "+5543988887777" },
        shippingAddress: { name: "Carla", phone: null, zip: "86020000", address1: "Rua C, 5", address2: null, city: "Londrina", provinceCode: "PR" } } : {}),
      lineItems: { nodes: [{ sku: "VEI-500", title: "Protetor 500 un", quantity: 2, originalUnitPriceSet: { shopMoney: { amount: "100.00" } }, totalDiscountSet: { shopMoney: { amount: "0.00" } } }] } }] } } });
  }
  // acessos da loja (RPC)
  if (u.pathname === "/rest/v1/rpc/loja_metricas") return send(res, { visitantes: 100, sessoes: 120, funil: { visitas: 120, produto: 80, carrinho: 20, checkout: 9 } });
  send(res, { error: "?" }, 404);
});

async function main() {
  await new Promise<void>((r) => server.listen(4020, r));
  const URL = "http://localhost:4020";
  Object.assign(process.env, {
    // endereço com caminho e slug com maiúscula, como foi digitado de verdade: o código normaliza
    ATENDENTE_URL_TESTE_SYNC: `${URL}/veipar`, ATENDENTE_CODE_TESTE_SYNC: "codigo-certo", ATENDENTE_SLUG_TESTE_SYNC: "Veipar",
    SHOPIFY_DOMAIN_TESTE_SYNC: URL, SHOPIFY_CLIENT_ID_TESTE_SYNC: "id", SHOPIFY_CLIENT_SECRET_TESTE_SYNC: "secret",
    LOJA_SUPABASE_URL_TESTE_SYNC: URL, LOJA_SUPABASE_KEY_TESTE_SYNC: "k",
  });
  const { ensureCompany } = await import("../lib/erp/auth");
  const { q, one } = await import("../lib/erp/db");
  const { syncTenant, syncStatus } = await import("../lib/erp/services/sync");
  const { syncTenants } = await import("../lib/erp/connectors/config");

  for (const t of ["erp_external_refs", "erp_channel_stats", "erp_sync_log", "erp_sync_state", "erp_titles", "erp_sales", "erp_stock_moves", "erp_products", "erp_invoices", "erp_parties", "erp_categories", "erp_accounts", "erp_company"]) {
    await q(T, `delete from ${t} where tenant = $1`);
  }
  await ensureCompany(T, "Teste Sync");
  let step = 0;
  const ok = (m: string) => console.log(`  ✓ ${++step}. ${m}`);
  const count = async (sql: string) => (await one<{ n: number }>(T, sql))!.n;

  assert.ok(syncTenants().includes("teste-sync"));
  ok("empresas com origem configurada são descobertas pelas variáveis");

  // --- 1ª rodada: tudo entra
  let reports = await syncTenant(T);
  assert.deepEqual(reports.map((r) => [r.source, r.ok]), [["atendente", true], ["loja", true], ["mercadolivre", true]], JSON.stringify(reports));
  assert.equal(await count("select count(*)::int as n from erp_parties where tenant = $1 and source = 'atendente'"), 2);
  assert.equal(await count("select count(*)::int as n from erp_sales where tenant = $1 and channel = 'whatsapp' and total = 480"), 1);
  assert.equal(await count("select count(*)::int as n from erp_sales where tenant = $1 and channel = 'mercadolivre' and total = 138.9"), 1);
  assert.equal(await count("select count(*)::int as n from erp_invoices i where tenant = $1 and kind = 'nfe' and sale_id is not null"), 1);
  assert.equal(await count("select count(*)::int as n from erp_sales where tenant = $1 and channel = 'loja' and total = 225"), 1);
  const joana = await one<{ status: string }>(T, "select status from erp_parties where tenant = $1 and name = 'Joana'");
  assert.equal(joana?.status, "lead");
  const diego = await one<{ document: string; city: string }>(T, "select document, city from erp_parties where tenant = $1 and source = 'mercadolivre'");
  assert.deepEqual(diego, { document: "52998224725", city: "Londrina" });
  const st = await q<{ funil: number }>(T, "select product_views as funil from erp_channel_stats where tenant = $1 and source = 'loja' and day = $2", [day]);
  assert.deepEqual(st, [{ funil: 80 }]);
  ok("1ª rodada: clientes, vendas do WhatsApp, pedido e nota do Mercado Livre, pedido da loja e funil");

  // --- estado e 2ª rodada: nada duplica, detalhes não são pedidos de novo
  const state = await syncStatus(T);
  assert.ok(state.every((s) => s.configured && s.synced_until === day && s.last_error === null), JSON.stringify(state));
  // a primeira rodada traz o recente e em seguida o histórico até o limite (60 dias), sem buraco
  assert.ok(state.every((s) => s.synced_from === back(60) && s.backfill_start === back(60)), JSON.stringify(state));
  const before = { ...world.calls };
  reports = await syncTenant(T);
  assert.ok(reports.every((r) => r.ok && r.created === 0), JSON.stringify(reports));
  assert.deepEqual(world.calls, before);
  assert.equal(await count("select count(*)::int as n from erp_sales where tenant = $1"), 3);
  assert.equal(await count("select count(*)::int as n from erp_parties where tenant = $1"), 4);
  ok("2ª rodada: nada duplica e o Mercado Livre não repete consulta de endereço e nota");

  // --- mudanças nas origens: ML cancela, loja cancela
  world.shopifyCancelled = iso();
  world.shopifyStatus = "REFUNDED";
  await syncTenant(T);
  const loja = await one<{ status: string; paid: number }>(T, "select status, (select count(*) from erp_titles where tenant = s.tenant and origin_id = s.id and status = 'paid')::int as paid from erp_sales s where tenant = $1 and channel = 'loja'");
  assert.deepEqual(loja, { status: "canceled", paid: 0 });
  ok("pedido cancelado/estornado na loja cancela a venda e desfaz o recebimento");

  // --- falha do atendente não derruba a loja
  world.loginOk = false;
  world.shopifyCancelled = null; world.shopifyStatus = "PAID";
  reports = await syncTenant(T);
  assert.deepEqual(reports.map((r) => r.ok), [false, true, false]); // atendente e Mercado Livre usam o mesmo login
  assert.match(reports[0].error ?? "", /login/);
  const bad = (await syncStatus(T)).find((s) => s.source === "atendente");
  assert.match(bad?.last_error ?? "", /login/);
  assert.equal(bad?.synced_until, day); // não avança quando falha
  world.loginOk = true;
  ok("login recusado: atendente e Mercado Livre registram o erro, a loja segue, a data não avança");

  // --- Shopify sem acesso a dados pessoais: segue sem cliente e avisa
  await q(T, "delete from erp_external_refs where tenant = $1 and source = 'loja'");
  await q(T, "delete from erp_sales where tenant = $1 and channel = 'loja'");
  world.denyPii = true;
  reports = await syncTenant(T, { sources: ["loja"] });
  assert.equal(reports[0].ok, true, JSON.stringify(reports));
  const semCliente = await one<{ customer_id: string | null }>(T, "select customer_id from erp_sales where tenant = $1 and channel = 'loja'");
  assert.equal(semCliente?.customer_id, null);
  assert.match((await syncStatus(T)).find((s) => s.source === "loja")?.last_error ?? "", /Aviso: A Shopify negou/);
  ok("Shopify sem acesso a dados pessoais: pedido entra sem cliente e a tela recebe o aviso");

  // --- tempo curto: o recente entra primeiro e o histórico continua na rodada seguinte
  for (const t of ["erp_sync_state"]) await q(T, `delete from ${t} where tenant = $1`);
  const cut = await syncTenant(T, { sources: ["mercadolivre"], budgetMs: 1 });
  assert.equal(cut[0].partial, true, JSON.stringify(cut));
  let ml = (await syncStatus(T)).find((s) => s.source === "mercadolivre")!;
  assert.deepEqual([ml.synced_from, ml.synced_until], [back(6), day]); // só a semana mais recente, contínua até hoje
  const rest = await syncTenant(T, { sources: ["mercadolivre"] });
  assert.equal(rest[0].partial, false, JSON.stringify(rest));
  ml = (await syncStatus(T)).find((s) => s.source === "mercadolivre")!;
  assert.deepEqual([ml.synced_from, ml.synced_until], [back(60), day]);
  ok("tempo curto: o dia mais novo entra primeiro e a rodada seguinte completa o histórico");

  // --- estado antigo (só synced_until, sem synced_from): a próxima rodada reabre o intervalo e chega a hoje
  await q(T, "update erp_sync_state set synced_from = null, synced_until = $2 where tenant = $1 and source = 'mercadolivre'", [back(55)]);
  await syncTenant(T, { sources: ["mercadolivre"] });
  ml = (await syncStatus(T)).find((s) => s.source === "mercadolivre")!;
  assert.ok(ml.synced_from! <= back(60) && ml.synced_until === day, JSON.stringify(ml)); // a releitura de 15 dias pode ir além do limite
  ok("estado de versão anterior (sem synced_from) é refeito até hoje e até o limite do histórico");

  console.log(`\n${step} verificações ok`);
  server.close();
  process.exit(0);
}
main().catch((e) => { console.error(e); server.close(); process.exit(1); });
