// Conciliação: cruza o dinheiro que entrou no banco (Open Banking) com o que o ERP sabe de vendas,
// recebimentos e notas. Funções puras: servem na tela e nos testes.

export type BankCredit = { id: string; date: string; amount: number; description: string; account: string };
export type ReceivedTitle = { id: string; description: string; amount: number; paid_at: string };
export type OpenTitle = { id: string; description: string; party: string | null; amount: number; due_date: string; sale_number: number | null };

export type Match = { credit: BankCredit; title: ReceivedTitle };
export type Suggestion = { credit: BankCredit; title: OpenTitle; days: number };

export type Reconciliation = {
  // entrada do banco que já tem a baixa correspondente no ERP
  matched: Match[];
  // entrada do banco que bate com uma conta a receber em aberto: falta só dar a baixa
  suggestions: Suggestion[];
  // entrada do banco sem nenhuma venda ou conta a receber correspondente
  orphans: BankCredit[];
  // baixa feita no ERP sem entrada no banco (pode ser dinheiro em espécie)
  paidWithoutBank: ReceivedTitle[];
};

const DAY = 86_400_000;
const daysApart = (a: string, b: string) => Math.round((Date.parse(`${a.slice(0, 10)}T12:00:00Z`) - Date.parse(`${b.slice(0, 10)}T12:00:00Z`)) / DAY);
const sameAmount = (a: number, b: number) => Math.abs(a - b) < 0.005;

// Janela em que um recebimento pode cair em relação ao vencimento: pagou adiantado ou atrasou.
const EARLY_DAYS = 20;
const LATE_DAYS = 90;
// Baixa e extrato costumam ter o mesmo dia ou diferir por fim de semana e compensação.
const SETTLE_DAYS = 4;

// Pareia sempre o par mais próximo no tempo primeiro e nunca usa o mesmo item duas vezes.
function greedy<C extends { date: string }, T>(
  credits: C[],
  titles: T[],
  fits: (c: C, t: T) => number | null
): { c: C; t: T; days: number }[] {
  const pairs: { ci: number; ti: number; days: number }[] = [];
  credits.forEach((c, ci) =>
    titles.forEach((t, ti) => {
      const days = fits(c, t);
      if (days !== null) pairs.push({ ci, ti, days });
    })
  );
  pairs.sort((a, b) => Math.abs(a.days) - Math.abs(b.days) || a.ci - b.ci || a.ti - b.ti);
  const usedC = new Set<number>();
  const usedT = new Set<number>();
  const out: { c: C; t: T; days: number }[] = [];
  for (const p of pairs) {
    if (usedC.has(p.ci) || usedT.has(p.ti)) continue;
    usedC.add(p.ci);
    usedT.add(p.ti);
    out.push({ c: credits[p.ci], t: titles[p.ti], days: p.days });
  }
  return out;
}

export function reconcile(credits: BankCredit[], received: ReceivedTitle[], open: OpenTitle[]): Reconciliation {
  const matchedPairs = greedy(credits, received, (c, t) => {
    const d = daysApart(c.date, t.paid_at);
    return sameAmount(c.amount, t.amount) && Math.abs(d) <= SETTLE_DAYS ? d : null;
  });
  const matchedC = new Set(matchedPairs.map((p) => p.c.id));
  const matchedT = new Set(matchedPairs.map((p) => p.t.id));

  const left = credits.filter((c) => !matchedC.has(c.id));
  const suggestionPairs = greedy(left, open, (c, t) => {
    const d = daysApart(c.date, t.due_date);
    return sameAmount(c.amount, t.amount) && d >= -EARLY_DAYS && d <= LATE_DAYS ? d : null;
  });
  const suggestedC = new Set(suggestionPairs.map((p) => p.c.id));

  return {
    matched: matchedPairs.map((p) => ({ credit: p.c, title: p.t })),
    suggestions: suggestionPairs.map((p) => ({ credit: p.c, title: p.t, days: p.days })),
    orphans: left.filter((c) => !suggestedC.has(c.id)),
    paidWithoutBank: received.filter((t) => !matchedT.has(t.id)),
  };
}

// ---------- cruzamento das curvas ----------

export type Curve = { key: string; label: string; values: number[] };
export type Crossing = {
  // posição entre dois dias: dia "index" mais a fração "t" até o seguinte
  index: number;
  t: number;
  value: number;
  // quem passou por cima de quem
  up: string;
  down: string;
};

// Pontos onde uma curva passa por cima da outra (as curvas são acumuladas, uma por dia).
// Empate no começo (tudo zero) não conta como cruzamento: só a troca de lado.
export function crossings(a: Curve, b: Curve): Crossing[] {
  const out: Crossing[] = [];
  let side = 0;
  for (let i = 0; i < a.values.length; i++) {
    const d = a.values[i] - b.values[i];
    if (Math.abs(d) < 0.005) continue;
    const s = d > 0 ? 1 : -1;
    if (side !== 0 && s !== side) {
      // as linhas se encontraram entre o dia anterior e este (ou exatamente no anterior, se lá já estavam juntas)
      const idx = i - 1;
      const d0 = a.values[idx] - b.values[idx];
      const frac = d0 / (d0 - d);
      out.push({
        index: idx,
        t: frac,
        value: a.values[idx] + (a.values[idx + 1] - a.values[idx]) * frac,
        up: s > 0 ? a.label : b.label,
        down: s > 0 ? b.label : a.label,
      });
    }
    side = s;
  }
  return out;
}

export function cumulative(perDay: number[]): number[] {
  let sum = 0;
  return perDay.map((v) => (sum += v));
}

export function daysInRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T12:00:00Z`); t <= Date.parse(`${to}T12:00:00Z`); t += DAY) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
