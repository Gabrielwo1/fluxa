// Dados 100% fictícios, só para demonstração na página pública.
export type DemoMonth = {
  key: string;
  label: string;
  future: boolean;
  income: number;
  card: number;
  bank: number;
  fixed: number;
};

export const DEMO_MONTHS: DemoMonth[] = [
  { key: "jun", label: "jun", future: false, income: 182000, card: 46000, bank: 85000, fixed: 0 },
  { key: "jul", label: "jul", future: false, income: 205000, card: 52000, bank: 116000, fixed: 0 },
  { key: "ago", label: "ago", future: false, income: 176000, card: 58000, bank: 114000, fixed: 0 },
  { key: "set", label: "set", future: false, income: 214000, card: 49000, bank: 100000, fixed: 0 },
  { key: "out", label: "out", future: false, income: 198000, card: 55000, bank: 86000, fixed: 0 },
  { key: "nov", label: "nov", future: true, income: 0, card: 27000, bank: 0, fixed: 98000 },
  { key: "dez", label: "dez", future: true, income: 0, card: 19000, bank: 0, fixed: 98000 },
];

export const expenseOf = (m: DemoMonth) => m.card + m.bank + m.fixed;

export const DEMO_SEGMENTS = [
  { label: "Fornecedores", share: 34 },
  { label: "Pessoal e serviços", share: 22 },
  { label: "Aluguel e estrutura", share: 15 },
  { label: "Impostos e taxas", share: 12 },
  { label: "Marketing", share: 9 },
  { label: "Outros", share: 8 },
];

export const RAMP = [
  "var(--ramp-1)",
  "var(--ramp-2)",
  "var(--ramp-3)",
  "var(--ramp-4)",
  "var(--ramp-5)",
  "var(--ramp-rest)",
];

export const brl0 = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export const brlK = (v: number) =>
  `R$ ${Math.round(v / 1000).toLocaleString("pt-BR")} mil`;
