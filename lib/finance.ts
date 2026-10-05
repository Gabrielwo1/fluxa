export type AccountLite = { id: string; type: "BANK" | "CREDIT" };

export type TxLite = {
  id: string;
  accountId: string;
  amount: number;
  date: string;
  category?: string | null;
};

export type Flow = {
  kind: "income" | "expense" | "invest" | "ignore";
  // income/expense: valor líquido (estorno de cartão vira negativo);
  // invest: aporte (positivo) ou resgate (negativo)
  value: number;
  channel?: "card" | "bank";
};

const INVEST_CATEGORIES = new Set([
  "Investments",
  "Mutual funds",
  "Fixed income investment",
  "Variable income investment",
]);

// movimentações entre contas próprias não são receita nem gasto
const INTERNAL_CATEGORIES = new Set([
  "Credit card payment",
  "Same person transfer",
]);

// O sinal das compras no cartão varia conforme o conector (MeuPluggy manda
// compras positivas, o sandbox manda negativas). Detecta por conta: o lado
// com mais movimentos (fora pagamento de fatura) é o das compras.
export function creditSigns(
  accounts: AccountLite[],
  txs: TxLite[]
): Map<string, 1 | -1> {
  const pos = new Map<string, number>();
  const neg = new Map<string, number>();
  const credit = new Set(
    accounts.filter((a) => a.type === "CREDIT").map((a) => a.id)
  );
  for (const t of txs) {
    if (!credit.has(t.accountId) || t.category === "Credit card payment") {
      continue;
    }
    const map = t.amount >= 0 ? pos : neg;
    map.set(t.accountId, (map.get(t.accountId) ?? 0) + Math.abs(t.amount));
  }
  const signs = new Map<string, 1 | -1>();
  for (const id of credit) {
    signs.set(id, (pos.get(id) ?? 0) >= (neg.get(id) ?? 0) ? 1 : -1);
  }
  return signs;
}

export function classify(
  t: TxLite,
  type: AccountLite["type"] | undefined,
  creditSign: 1 | -1 = 1
): Flow {
  const cat = t.category ?? "";
  if (cat === "Credit card payment") return { kind: "ignore", value: 0 };

  if (type === "CREDIT") {
    return { kind: "expense", value: t.amount * creditSign, channel: "card" };
  }

  if (INVEST_CATEGORIES.has(cat)) {
    return { kind: "invest", value: -t.amount };
  }
  if (INTERNAL_CATEGORIES.has(cat)) return { kind: "ignore", value: 0 };

  if (t.amount < 0) {
    return { kind: "expense", value: -t.amount, channel: "bank" };
  }
  return { kind: "income", value: t.amount };
}
