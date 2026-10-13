// Projeção de renda fixa atrelada ao CDI. É uma estimativa: assume CDI constante no
// período, imposto de renda regressivo e nenhum IOF (só pesa nos primeiros 30 dias).

const BUSINESS_DAYS_YEAR = 252;
const BUSINESS_DAYS_MONTH = BUSINESS_DAYS_YEAR / 12;
const DAYS_MONTH = 30.4375;
const DAY_MS = 86_400_000;

// CDI em % ao ano (ex.: 13.65) e rentabilidade em % do CDI (ex.: 120)
export function growth(months: number, cdiAnnual: number, pctOfCdi: number): number {
  const dailyCdi = Math.pow(1 + cdiAnnual / 100, 1 / BUSINESS_DAYS_YEAR) - 1;
  return Math.pow(1 + (dailyCdi * pctOfCdi) / 100, BUSINESS_DAYS_MONTH * months);
}

// tabela regressiva da renda fixa, pelos dias corridos desde a aplicação
export function irRate(days: number): number {
  if (days <= 180) return 0.225;
  if (days <= 360) return 0.2;
  if (days <= 720) return 0.175;
  return 0.15;
}

export type Position = {
  gross: number; // valor bruto hoje
  principal: number; // quanto foi aplicado
  pctOfCdi: number;
  ageDays: number; // dias desde a aplicação
  exempt: boolean; // LCI/LCA e afins
};

export function netValue(p: Position, months: number, cdiAnnual: number): number {
  const gross = p.gross * growth(months, cdiAnnual, p.pctOfCdi);
  const gain = Math.max(0, gross - p.principal);
  const tax = p.exempt ? 0 : irRate(p.ageDays + months * DAYS_MONTH) * gain;
  return gross - tax;
}

type RawInvestment = {
  balance: number;
  rate?: number | null;
  rateType?: string | null;
  amount?: number | null;
  amountOriginal?: number | null;
  purchaseDate?: string | null;
  subtype?: string | null;
  taxExempt?: boolean | null;
};

const EXEMPT_SUBTYPES = ["LCI", "LCA", "CRI", "CRA", "LIG"];

// Converte uma posição da Pluggy. Devolve também se a taxa era CDI de fato:
// outros indexadores (pré, IPCA) entram como 100% do CDI, só para ter uma ordem de grandeza.
export function toPosition(
  inv: RawInvestment,
  now: number
): { position: Position; estimated: boolean } {
  const gross = inv.amount && inv.amount > 0 ? inv.amount : inv.balance;
  const original = inv.amountOriginal && inv.amountOriginal > 0 ? inv.amountOriginal : gross;
  const isCdi = inv.rateType === "CDI" && !!inv.rate && inv.rate > 0;
  const bought = inv.purchaseDate ? new Date(inv.purchaseDate).getTime() : now;
  return {
    position: {
      gross,
      principal: Math.min(original, gross),
      pctOfCdi: isCdi ? (inv.rate as number) : 100,
      ageDays: Math.max(0, (now - bought) / DAY_MS),
      exempt:
        inv.taxExempt === true || EXEMPT_SUBTYPES.includes((inv.subtype ?? "").toUpperCase()),
    },
    estimated: !isCdi,
  };
}

export type SimulationInput = {
  initial: number;
  monthly: number;
  months: number;
  cdiAnnual: number;
  pctOfCdi: number;
  exempt: boolean;
};

export type SimulationPoint = {
  month: number;
  invested: number; // inicial + aportes
  gross: number;
  tax: number;
  net: number;
};

// Cada aporte é uma "fatia" com a própria idade, e o IR regressivo vale por fatia.
export function simulate(input: SimulationInput): SimulationPoint[] {
  const { initial, monthly, months, cdiAnnual, pctOfCdi, exempt } = input;
  const factors: number[] = [];
  for (let k = 0; k <= months; k++) factors.push(growth(k, cdiAnnual, pctOfCdi));

  const points: SimulationPoint[] = [];
  for (let m = 0; m <= months; m++) {
    let gross = 0;
    let tax = 0;
    // fatia inicial (idade m) e aportes feitos no fim de cada mês 1..m (idade m-k)
    for (let k = 0; k <= m; k++) {
      const principal = k === 0 ? initial : monthly;
      if (principal <= 0) continue;
      const age = m - k;
      const g = principal * factors[age];
      gross += g;
      if (!exempt) tax += irRate(age * DAYS_MONTH) * (g - principal);
    }
    points.push({
      month: m,
      invested: initial + monthly * m,
      gross,
      tax,
      net: gross - tax,
    });
  }
  return points;
}

// O valor final é linear no aporte, então o aporte necessário sai direto.
export function monthlyForGoal(
  goal: number,
  input: Omit<SimulationInput, "monthly">
): number {
  const base = simulate({ ...input, monthly: 0 }).at(-1)?.net ?? 0;
  const one = simulate({ ...input, monthly: 1 }).at(-1)?.net ?? 0;
  const perReal = one - base;
  return perReal > 0 ? (goal - base) / perReal : 0;
}

export function parseNumber(text: string): number {
  const clean = text.replace(/[^\d,.-]/g, "");
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}
