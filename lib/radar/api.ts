// Radar Empresas dentro do Fluxa: a base de CNPJ (Receita Federal) fica numa API própria na VPS.
// Só o servidor do Fluxa fala com ela; a chave nunca vai para o navegador.
// O repositório do Radar não é alterado: o Fluxa usa a mesma API, com o login do próprio Fluxa.

export const radarConfigured = () => Boolean(process.env.RADAR_API_URL && process.env.RADAR_API_KEY);

export async function radarFetch(path: string, opts: { signal?: AbortSignal } = {}) {
  const base = (process.env.RADAR_API_URL ?? "").replace(/\/+$/, "");
  return fetch(`${base}/${path}`, {
    headers: { "x-api-key": process.env.RADAR_API_KEY ?? "" },
    cache: "no-store",
    signal: opts.signal ?? AbortSignal.timeout(35_000),
  });
}

export async function radarJson<T>(path: string): Promise<T> {
  const res = await radarFetch(path);
  if (!res.ok) throw new Error(`Radar respondeu ${res.status}`);
  return (await res.json()) as T;
}

// Parâmetros de busca aceitos pela API (o resto é descartado antes de chegar na VPS).
export const RADAR_FILTERS = [
  "uf", "municipio", "cnae", "cnae_secundario", "porte", "situacao", "simples", "mei", "matriz",
  "abertura_de", "abertura_ate", "capital_min", "capital_max", "com_telefone", "com_email",
  "bairro", "q", "cnpjs", "ordem", "page", "limit",
] as const;

export type RadarCompany = {
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  situacao: number;
  situacao_descricao: string | null;
  data_abertura: string | null;
  cnae_principal: number | null;
  cnae_descricao: string | null;
  porte: number | null;
  porte_descricao: string | null;
  capital_social: number | null;
  simples: boolean | null;
  mei: boolean | null;
  matriz: boolean | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  telefone1: string | null;
  telefone2: string | null;
  email: string | null;
  tipo_logradouro: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  cep: string | null;
  contato_bloqueado?: boolean;
};

export type RadarList = { total: number; pagina: number; limite: number; resultados: RadarCompany[] };
