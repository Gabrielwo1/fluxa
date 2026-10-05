export const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

const MONTH_LABELS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_LABELS[m - 1]}/${String(y).slice(2)}`;
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

export function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  for (const f of [1, 2, 2.5, 5, 10]) {
    if (f * pow >= v) return f * pow;
  }
  return 10 * pow;
}

export function pct(v: number, base: number): number | null {
  return base > 0 ? Math.round((v / base) * 100) : null;
}

// "Compra no débito|POSTO X": o estabelecimento vira o título e o tipo da
// operação vai para a linha de apoio
export function splitDescription(d: string): { title: string; kind: string | null } {
  const parts = d.split("|").map((x) => x.trim()).filter(Boolean);
  if (parts.length < 2) return { title: d, kind: null };
  return { title: parts.slice(1).join(" · "), kind: parts[0] };
}
