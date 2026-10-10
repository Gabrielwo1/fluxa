import { MUNICIPIOS_NFSE } from "@/lib/data/municipios-nfse";

/**
 * Situação de cada município no Sistema Nacional NFS-e, pela lista oficial de adesões.
 * Use só em código de servidor: a tabela tem todos os municípios do país e não deve ir para o navegador.
 * (Não usamos o pacote server-only porque ele impede rodar os testes com tsx.)
 */

type Flag = 0 | 1 | null;
const DADOS = JSON.parse(MUNICIPIOS_NFSE) as {
  atualizadoEm: string | null;
  municipios: Record<string, [string, string, Flag, Flag]>;
};
const TABELA = DADOS.municipios;

export const LISTA_ATUALIZADA_EM: string | null = DADOS.atualizadoEm;

export interface SituacaoMunicipio {
  codigo: string;
  nome: string;
  uf: string;
  /** O município aceita emissão pelo emissor nacional (portal e API do governo). null = não consta na lista. */
  emissorNacional: boolean | null;
  /** O município compartilha as notas com o ambiente nacional. Permite importar histórico pelo certificado. */
  ambienteNacional: boolean | null;
}

export function situacaoMunicipio(codigoIbge: string): SituacaoMunicipio | null {
  const linha = TABELA[codigoIbge];
  if (!linha) return null;
  const [nome, uf, emissor, ambiente] = linha;
  const bool = (f: Flag) => (f === null ? null : f === 1);
  return { codigo: codigoIbge, nome, uf, emissorNacional: bool(emissor), ambienteNacional: bool(ambiente) };
}

export type AvisoMunicipio =
  | { tipo: "ok" }
  | { tipo: "desconhecido"; municipio: string }
  | { tipo: "sistema-proprio"; municipio: string; podeImportar: boolean };

/**
 * Decide se o emitente precisa ser avisado sobre a cidade.
 *
 * O MEI emite sempre pelo emissor nacional, em qualquer município, então para ele nunca há aviso.
 * As demais empresas dependem de o município ter aderido ao emissor nacional. Quando não aderiu,
 * a nota é emitida no sistema da prefeitura e o app não consegue emitir por essa cidade.
 */
export function avisoMunicipio(codigoIbge: string, regime: string): AvisoMunicipio {
  if (regime === "MEI") return { tipo: "ok" };
  const s = situacaoMunicipio(codigoIbge);
  if (!s || s.emissorNacional === null) return { tipo: "desconhecido", municipio: s ? `${s.nome}/${s.uf}` : codigoIbge };
  if (s.emissorNacional) return { tipo: "ok" };
  return { tipo: "sistema-proprio", municipio: `${s.nome}/${s.uf}`, podeImportar: s.ambienteNacional === true };
}
