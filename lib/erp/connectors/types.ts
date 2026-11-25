import type { Source } from "@/lib/erp/services/ingest";

// Um conector sabe buscar numa origem os dados de um intervalo de dias e devolve em pedaços, no mesmo
// formato que POST /api/ingest aceita. Vai do dia mais novo para o mais antigo, em janelas; o último
// pedaço de cada janela leva "window", que diz que todos os dias dela já foram buscados.
export type Payload = { customers?: unknown[]; orders?: unknown[]; invoices?: unknown[]; stats?: unknown[] };
export type Window = { from: string; to: string };
export type Chunk = { payload: Payload; window?: Window };

export type ConnectorCtx = {
  tenant: string;
  // quais ids de pedido/nota (na origem) já existem no Fluxa: evita refazer consultas caras
  // "sale": pedidos já cadastrados; "invoice": pedidos que já têm nota fiscal ligada
  known: (kind: "sale" | "invoice", source: Source, ids: string[]) => Promise<Set<string>>;
  // algo que não impede a sincronização mas a equipe precisa saber (ex.: dados pessoais negados pela origem)
  warn: (message: string) => void;
};

export type Connector = {
  source: Source;
  // quantos dias para trás reler a cada sincronização (pagamento, cancelamento e nota fiscal chegam depois do pedido)
  overlapDays: number;
  run: (ctx: ConnectorCtx, from: string, to: string) => AsyncGenerator<Chunk>;
};

export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

// Janelas de "size" dias do fim para o começo: [to-size+1, to], [to-2*size+1, to-size]… até chegar em "from".
export function windowsNewestFirst(from: string, to: string, size = 7): Window[] {
  const out: Window[] = [];
  for (let end = to; end >= from; end = addDays(end, -size)) {
    const start = addDays(end, -(size - 1));
    out.push({ from: start < from ? from : start, to: end });
  }
  return out;
}

export const chunked = <T,>(list: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

// Falha de rede ou resposta de erro de uma origem, com o nome dela na mensagem.
export async function readJson<T>(res: Response, what: string): Promise<T> {
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`${what}: resposta ${res.status}${body ? ` (${body})` : ""}`);
  }
  return (await res.json()) as T;
}
