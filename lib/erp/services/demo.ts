import { HttpError } from "@/lib/tenant";
import { one, tx } from "@/lib/erp/db";
import { createParty } from "@/lib/erp/services/parties";
import { createProduct } from "@/lib/erp/services/products";
import { createPurchase } from "@/lib/erp/services/purchases";
import { createSale } from "@/lib/erp/services/sales";
import { createRecurring, createTitles, listAccounts, listCategories, listTitles, payTitle } from "@/lib/erp/services/finance";

const brtToday = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date(`${brtToday()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

// gerador pseudo-aleatório com semente fixa: os exemplos são sempre os mesmos
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// Cria uma empresa de exemplo (loja de materiais de escritório com serviços), toda marcada
// como "exemplo" para poder ser apagada de uma vez sem mexer nos dados reais.
export async function loadDemo(tenant: string): Promise<void> {
  const meta = await one<{ has_demo: boolean }>(tenant, "select has_demo from erp_company where tenant = $1");
  if (meta?.has_demo) throw new HttpError(409, "Os dados de exemplo já foram carregados.");
  const started = (await one<{ now: string }>(tenant, "select now()::text as now from erp_company where tenant = $1"))!.now;
  const rand = rng(42);

  const customersRaw = [
    ["Mercado Boa Compra Ltda", "pj", "active"], ["Clínica Vida & Saúde", "pj", "active"], ["Escola Aprender Mais", "pj", "active"],
    ["Marcos Oliveira", "pf", "active"], ["Fernanda Lima", "pf", "active"], ["Auto Center Rota 66", "pj", "active"],
    ["Studio Bella Forma", "pj", "lead"], ["Ricardo Almeida", "pf", "active"],
  ] as const;
  const customers: string[] = [];
  for (const [name, type, status] of customersRaw) {
    const p = await createParty(tenant, {
      name, person_type: type, status, is_customer: true, is_supplier: false,
      phone: "(11) 9" + String(Math.floor(rand() * 90000000 + 10000000)), city: "São Paulo", state: "SP",
      email: name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "") + "@exemplo.com.br",
    });
    customers.push(p.id);
  }
  const suppliers: string[] = [];
  for (const name of ["Distribuidora Papel Forte", "Tech Suprimentos Ltda", "Gráfica Rápida"]) {
    const p = await createParty(tenant, {
      name, person_type: "pj", is_customer: false, is_supplier: true, status: "active", city: "Campinas", state: "SP",
    });
    suppliers.push(p.id);
  }

  const catalog: [string, string, "product" | "service", string, number, number, number, number][] = [
    // nome, sku, tipo, categoria, custo, preço, estoque inicial, mínimo
    ["Caderno universitário 200 folhas", "CAD-200", "product", "Papelaria", 9.5, 22.9, 60, 20],
    ["Caneta esferográfica azul (cx 50)", "CAN-AZ50", "product", "Papelaria", 38, 79.9, 25, 8],
    ["Papel sulfite A4 (resma 500)", "PAP-A4", "product", "Papelaria", 21.5, 34.9, 120, 40],
    ["Cartucho de tinta preto", "CAR-PT", "product", "Informática", 48, 99, 18, 6],
    ["Mouse sem fio", "MOU-SF", "product", "Informática", 29, 64.9, 30, 10],
    ["Teclado ABNT2", "TEC-AB", "product", "Informática", 41, 89.9, 14, 5],
    ["Cadeira de escritório", "CAD-ESC", "product", "Móveis", 210, 459, 9, 3],
    ["Pasta arquivo AZ", "PAS-AZ", "product", "Papelaria", 6.2, 15.9, 70, 25],
    ["Instalação e configuração de rede", "SRV-REDE", "service", "Serviços", 0, 350, 0, 0],
    ["Manutenção de computador", "SRV-MAN", "service", "Serviços", 0, 180, 0, 0],
  ];
  const products: { id: string; name: string; price: number; cost: number; service: boolean }[] = [];
  for (const [name, sku, kind, category, cost, price, stock, min] of catalog) {
    const p = await createProduct(tenant, {
      name, sku, kind, category, cost_price: cost, sale_price: price, track_stock: kind === "product",
      min_stock: min, initial_stock: stock * 4, unit: "un",
    });
    products.push({ id: p.id, name, price, cost, service: kind === "service" });
  }

  // uma compra recebida e paga e outra aberta, para o financeiro ter o que mostrar
  const buy = await createPurchase(tenant, {
    supplier_id: suppliers[0], issue_date: daysAgo(40),
    items: [
      { product_id: products[2].id, description: products[2].name, qty: 40, unit_cost: 21.5 },
      { product_id: products[0].id, description: products[0].name, qty: 30, unit_cost: 9.5 },
    ],
    receive: { method: "Boleto", installments: 2, first_due: daysAgo(10), interval_days: 30, paid_now: false, account_id: null },
  });
  void buy;
  await createPurchase(tenant, {
    supplier_id: suppliers[1], issue_date: daysAgo(3),
    items: [{ product_id: products[4].id, description: products[4].name, qty: 20, unit_cost: 29 }],
    receive: { method: "Pix", installments: 1, first_due: daysAgo(-12), interval_days: 30, paid_now: false, account_id: null },
  });

  // vendas distribuídas pelos últimos ~5 meses, a maioria paga, algumas em aberto e atrasadas
  const sellable = products;
  const saleIds: string[] = [];
  for (let n = 0; n < 58; n++) {
    const age = Math.floor((n / 58) * 150 + rand() * 4);
    const customer = rand() < 0.15 ? null : customers[Math.floor(rand() * 6)];
    const itemCount = 1 + Math.floor(rand() * 3);
    const picked = new Set<number>();
    while (picked.size < itemCount) picked.add(Math.floor(rand() * sellable.length));
    const items = [...picked].map((idx) => {
      const p = sellable[idx];
      return {
        product_id: p.id, description: p.name, qty: p.service ? 1 + Math.floor(rand() * 2) : 2 + Math.floor(rand() * 7),
        unit_price: p.price, discount: 0,
      };
    });
    const parcels = customer && rand() < 0.35 ? 2 : 1;
    try {
      const sale = await createSale(tenant, {
        customer_id: customer, issue_date: daysAgo(age), items, discount: 0, notes: "",
        payment_method: "",
        confirm: {
          method: parcels > 1 ? "Boleto" : ["Pix", "Cartão de débito", "Dinheiro"][Math.floor(rand() * 3)],
          installments: parcels, first_due: daysAgo(age - 30), interval_days: 30,
          paid_now: !customer || (parcels === 1 && rand() < 0.5), account_id: null,
        },
      });
      saleIds.push(sale.id);
    } catch {
      // se faltar estoque em algum exemplo, só pula essa venda
    }
  }
  // dois orçamentos em aberto
  await createSale(tenant, {
    customer_id: customers[6], issue_date: daysAgo(6), notes: "Pediu desconto na instalação.", payment_method: "", discount: 0,
    items: [{ product_id: products[8].id, description: products[8].name, qty: 1, unit_price: 350, discount: 0 }],
  });
  await createSale(tenant, {
    customer_id: customers[1], issue_date: daysAgo(1), notes: "", payment_method: "", discount: 50,
    items: [{ product_id: products[6].id, description: products[6].name, qty: 4, unit_price: 459, discount: 0 }],
  });

  // dá baixa nas parcelas já vencidas há mais de 12 dias (menos duas, que ficam atrasadas de propósito)
  const accounts = await listAccounts(tenant);
  const bank = accounts.find((a) => a.kind === "bank") ?? accounts[0];
  const due = (await listTitles(tenant, { status: "open", limit: 500 }));
  let kept = 0;
  for (const t of due) {
    if (t.days_late > 12 && t.direction === "in") {
      if (kept < 2) { kept++; continue; }
      await payTitle(tenant, t.id, { paid_at: t.due_date, paid_amount: t.amount, account_id: bank.id });
    }
  }

  // despesas e recorrências
  const cats = await listCategories(tenant);
  const cat = (name: string) => cats.find((c) => c.name === name)?.id ?? null;
  await createRecurring(tenant, { direction: "out", description: "Aluguel da loja", category_id: cat("Aluguel"), party_id: null, amount: 3200, day: 5, active: true });
  await createRecurring(tenant, { direction: "out", description: "Internet e telefone", category_id: cat("Água, luz e internet"), party_id: null, amount: 289.9, day: 12, active: true });
  await createRecurring(tenant, { direction: "in", description: "Contrato de suporte mensal", category_id: cat("Prestação de serviços"), party_id: customers[2], amount: 650, day: 10, active: true });
  await createTitles(tenant, {
    direction: "out", description: "Energia elétrica", category_id: cat("Água, luz e internet"), party_id: null, amount: 412.37,
    due_date: daysAgo(-4), installments: 1, notes: "", paid_now: false, account_id: null,
  });
  await createTitles(tenant, {
    direction: "out", description: "Anúncios online", category_id: cat("Marketing e anúncios"), party_id: null, amount: 600,
    due_date: daysAgo(20), installments: 1, notes: "", paid_now: true, account_id: bank.id,
  });

  // marca tudo que foi criado agora como exemplo
  await tx(tenant, async (t) => {
    for (const table of ["erp_parties", "erp_products", "erp_stock_moves", "erp_sales", "erp_purchases", "erp_titles", "erp_recurring"]) {
      await t.q(`update ${table} set demo = true where tenant = $1 and created_at >= $2::timestamptz`, [started]);
    }
    await t.q("update erp_company set has_demo = true where tenant = $1");
  });
}

export async function removeDemo(tenant: string): Promise<void> {
  await tx(tenant, async (t) => {
    await t.q("delete from erp_titles where tenant = $1 and demo");
    await t.q("delete from erp_recurring where tenant = $1 and demo");
    await t.q("delete from erp_sales where tenant = $1 and demo");
    await t.q("delete from erp_purchases where tenant = $1 and demo");
    await t.q("delete from erp_stock_moves where tenant = $1 and demo");
    await t.q("delete from erp_products where tenant = $1 and demo");
    await t.q("delete from erp_parties where tenant = $1 and demo");
    // zera os números para a primeira venda real ser a nº 1
    await t.q(
      `update erp_company set has_demo = false,
         next_sale_number = coalesce((select max(number) from erp_sales where tenant = $1), 0) + 1,
         next_purchase_number = coalesce((select max(number) from erp_purchases where tenant = $1), 0) + 1
       where tenant = $1`
    );
  });
}
