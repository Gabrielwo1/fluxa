import { XMLParser } from "fast-xml-parser";

/**
 * Leitura do XML de uma NFS-e do padrão nacional.
 *
 * O leiaute aninha a DPS dentro da NFS-e e varia entre versões, então a busca aqui é por
 * NOME DE TAG em profundidade, não por caminho fixo. Isso sobrevive a mudanças de estrutura
 * que quebrariam um acesso do tipo `NFSe.infNFSe.DPS.infDPS.serv.cServ.xDescServ`.
 */

export interface NotaImportada {
  chaveAcesso: string;
  numeroNfse?: string;
  serie: number;
  numeroDps: number;
  /** AAAA-MM-DD */
  competencia: string;
  valor: number;
  /** CNPJ de quem emitiu a nota. Usado para separar o que o MEI emitiu do que ele recebeu. */
  prestadorDocumento: string;
  tomadorNome: string;
  tomadorDocumento: string;
  descricao: string;
  codigoTributacaoNacional?: string;
  xml: string;
}

export const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  parseTagValue: false,
  trimValues: true,
  // Remove prefixo de namespace (ns2:infNFSe -> infNFSe) para a busca por nome funcionar.
  transformTagName: (t) => t.replace(/^.*:/, ""),
});

export type No = Record<string, unknown>;

/** Busca em profundidade o primeiro nó com este nome de tag. */
export function achar(raiz: unknown, nome: string): unknown {
  if (raiz === null || typeof raiz !== "object") return undefined;
  const obj = raiz as No;
  if (nome in obj) return obj[nome];
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        const r = achar(item, nome);
        if (r !== undefined) return r;
      }
    } else if (v && typeof v === "object") {
      const r = achar(v, nome);
      if (r !== undefined) return r;
    }
  }
  return undefined;
}

/** Primeiro valor de texto entre vários nomes de tag possíveis. */
export function texto(raiz: unknown, ...nomes: string[]): string | undefined {
  for (const n of nomes) {
    const v = achar(raiz, n);
    if (v === undefined || v === null) continue;
    if (typeof v === "string" || typeof v === "number") return String(v).trim();
    if (typeof v === "object") {
      const t = (v as No)["#text"];
      if (typeof t === "string" || typeof t === "number") return String(t).trim();
    }
  }
  return undefined;
}

export function numero(raiz: unknown, ...nomes: string[]): number | undefined {
  const t = texto(raiz, ...nomes);
  if (t === undefined) return undefined;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/** Extrai só os dígitos da chave de acesso, que tem 50 posições. */
export function extrairChave(raiz: unknown): string | undefined {
  const direta = texto(raiz, "chaveAcesso", "chNFSe", "ChaveAcesso");
  if (direta && /^\d{50}$/.test(direta.replace(/\D/g, ""))) return direta.replace(/\D/g, "");

  // Fallback: o Id do infNFSe é "NFS" + chave.
  const inf = achar(raiz, "infNFSe");
  const id = inf && typeof inf === "object" ? (inf as No)["@Id"] : undefined;
  if (typeof id === "string") {
    const d = id.replace(/\D/g, "");
    if (d.length >= 50) return d.slice(-50);
  }
  return undefined;
}

/** Documento do tomador: pode vir como CNPJ, CPF ou NIF (estrangeiro). */
export function documento(no: unknown): string | undefined {
  const d = texto(no, "CNPJ", "CPF", "NIF");
  return d ? d.replace(/\D/g, "") : undefined;
}

export class XmlInvalidoError extends Error {}

/**
 * Converte o XML de uma NFS-e no formato que o app guarda.
 * Lança XmlInvalidoError quando faltam os campos sem os quais a nota não serve para nada.
 */
export function lerNfse(xml: string): NotaImportada {
  let raiz: unknown;
  try {
    raiz = parser.parse(xml);
  } catch {
    throw new XmlInvalidoError("Não é um XML válido");
  }

  const chaveAcesso = extrairChave(raiz);
  if (!chaveAcesso) throw new XmlInvalidoError("Chave de acesso não encontrada no XML");

  const valor =
    numero(achar(raiz, "vServPrest"), "vServ") ??
    numero(raiz, "vServ", "vLiq", "valorServico");
  if (valor === undefined) throw new XmlInvalidoError("Valor do serviço não encontrado");

  // dCompet é a competência; se faltar, cai para a data de emissão da DPS ou do processamento.
  const competenciaBruta = texto(raiz, "dCompet", "dhEmi", "dhProc");
  if (!competenciaBruta) throw new XmlInvalidoError("Data de competência não encontrada");
  const competencia = competenciaBruta.slice(0, 10);

  // Dentro de <prest> e <toma> os dois têm uma tag CNPJ, então isolamos cada bloco antes.
  const prest = achar(raiz, "prest") ?? achar(raiz, "emit");
  const toma = achar(raiz, "toma") ?? achar(raiz, "tomador");

  const prestadorDocumento = documento(prest);
  if (!prestadorDocumento) throw new XmlInvalidoError("CNPJ do prestador não encontrado");

  return {
    chaveAcesso,
    numeroNfse: texto(raiz, "nNFSe"),
    serie: numero(raiz, "serie") ?? 1,
    numeroDps: numero(raiz, "nDPS") ?? 0,
    competencia,
    valor,
    prestadorDocumento,
    tomadorNome: texto(toma, "xNome") ?? "Cliente não identificado",
    tomadorDocumento: documento(toma) ?? "",
    descricao: texto(raiz, "xDescServ", "discriminacao") ?? "Serviço não descrito",
    codigoTributacaoNacional: texto(raiz, "cTribNac"),
    xml,
  };
}
