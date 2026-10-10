/** Regras e agregações financeiras do MEI. Puro, sem I/O. */

/** Limite anual de faturamento do MEI (Lei Complementar 123, valor vigente). */
export const LIMITE_MEI_ANUAL = 81_000;
/** Acima de 20% do limite o MEI é desenquadrado retroativamente. */
export const TETO_TOLERANCIA_MEI = LIMITE_MEI_ANUAL * 1.2;

export type StatusNota = "processando" | "emitida" | "simulada" | "registrada" | "erro" | "cancelada";

/** Status que contam no faturamento. Simulação e erro não contam; cancelada não conta. */
export const STATUS_FATURADO: StatusNota[] = ["emitida", "registrada"];

export interface NotaResumo {
  valor: number;
  competencia: string; // AAAA-MM-DD
  status: StatusNota;
  tomadorNome: string;
}

export interface MesTotal {
  mes: string; // AAAA-MM
  total: number;
  quantidade: number;
}

export function mesDe(data: string): string {
  return data.slice(0, 7);
}

export function mesAtual(hoje = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(hoje).slice(0, 7);
}

/** Lista dos últimos N meses (AAAA-MM), do mais antigo ao atual. */
export function ultimosMeses(n: number, hoje = new Date()): string[] {
  const [ano, mes] = mesAtual(hoje).split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(ano, mes - 1 - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

export interface Resumo {
  meses: MesTotal[];
  anoAtual: number;
  mesAtual: number;
  mesAnterior: number;
  /** Soma das notas em emissão (processando). */
  pendentesValor: number;
  mediaMensal: number;
  totalNotas: number;
  pendentes: number;
  limiteAnual: number;
  percentualLimite: number;
  topClientes: { nome: string; total: number; quantidade: number }[];
}

export function calcularResumo(notas: NotaResumo[], regime: string, hoje = new Date()): Resumo {
  const meses = ultimosMeses(12, hoje);
  const porMes = new Map(meses.map((m) => [m, { mes: m, total: 0, quantidade: 0 }]));
  const ano = mesAtual(hoje).slice(0, 4);
  const mAtual = mesAtual(hoje);
  let anoAtual = 0;
  let mesAtualTotal = 0;
  let mesAnteriorTotal = 0;
  let pendentes = 0;
  let pendentesValor = 0;
  const mAnterior = meses[meses.length - 2];
  const clientes = new Map<string, { nome: string; total: number; quantidade: number }>();

  for (const n of notas) {
    if (n.status === "processando" || n.status === "erro") pendentes++;
    if (n.status === "processando") pendentesValor += n.valor;
    if (!STATUS_FATURADO.includes(n.status)) continue;
    const m = mesDe(n.competencia);
    const slot = porMes.get(m);
    if (slot) {
      slot.total += n.valor;
      slot.quantidade++;
    }
    if (m.startsWith(ano)) anoAtual += n.valor;
    if (m === mAtual) mesAtualTotal += n.valor;
    if (m === mAnterior) mesAnteriorTotal += n.valor;
    const c = clientes.get(n.tomadorNome) ?? { nome: n.tomadorNome, total: 0, quantidade: 0 };
    c.total += n.valor;
    c.quantidade++;
    clientes.set(n.tomadorNome, c);
  }

  const mesesComNota = [...porMes.values()].filter((m) => m.quantidade > 0);
  const mediaMensal = mesesComNota.length ? mesesComNota.reduce((a, m) => a + m.total, 0) / mesesComNota.length : 0;
  const limiteAnual = regime === "MEI" ? LIMITE_MEI_ANUAL : 0;

  return {
    meses: [...porMes.values()],
    anoAtual,
    mesAtual: mesAtualTotal,
    mesAnterior: mesAnteriorTotal,
    pendentesValor,
    mediaMensal,
    totalNotas: notas.filter((n) => STATUS_FATURADO.includes(n.status)).length,
    pendentes,
    limiteAnual,
    percentualLimite: limiteAnual ? anoAtual / limiteAnual : 0,
    topClientes: [...clientes.values()].sort((a, b) => b.total - a.total).slice(0, 5),
  };
}
