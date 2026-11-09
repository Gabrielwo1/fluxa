import { brl } from "@/lib/format";

export const money = (n: number | null | undefined) => brl.format(n ?? 0);

export const qtyFmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

// "2026-10-05" -> "05/10/2026"
export const fmtDate = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

export const fmtDateShort = (iso: string) => iso.slice(0, 10).split("-").reverse().slice(0, 2).join("/");

export const todayIso = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

export const addDaysIso = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const monthStartIso = (iso = todayIso()) => `${iso.slice(0, 7)}-01`;

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const monthShort = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`;

// aceita "1.234,56", "1234,56" e "1234.56"
export function parseMoney(text: string): number {
  const clean = text.replace(/[^\d,.-]/g, "");
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

export const moneyInput = (n: number) => (n ? n.toFixed(2).replace(".", ",") : "");

export function dueLabel(due: string, status: string, today = todayIso()): { text: string; tone: "late" | "soon" | "ok" | "done" } {
  if (status === "paid") return { text: "Pago", tone: "done" };
  if (due < today) {
    const days = Math.round((Date.parse(today) - Date.parse(due)) / 86_400_000);
    return { text: `Atrasado há ${days} ${days === 1 ? "dia" : "dias"}`, tone: "late" };
  }
  if (due === today) return { text: "Vence hoje", tone: "soon" };
  const days = Math.round((Date.parse(due) - Date.parse(today)) / 86_400_000);
  return { text: days === 1 ? "Vence amanhã" : `Vence em ${days} dias`, tone: days <= 7 ? "soon" : "ok" };
}
