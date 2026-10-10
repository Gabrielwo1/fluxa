import https from "https";
import zlib from "zlib";
import type { Ambiente } from "./tipos";
import type { CertificadoA1 } from "./assinatura";

/**
 * API de distribuição do ADN (Ambiente de Dados Nacional).
 *
 * É por aqui que se puxa o histórico: o ADN devolve os documentos fiscais em que o CNPJ
 * aparece como emitente, tomador ou intermediário, paginados por NSU (número sequencial único).
 *
 *   GET /DFe/{NSU}                    -> lote de documentos com NSU maior ou igual ao informado
 *   GET /NFSe/{chaveAcesso}/Eventos   -> eventos de uma nota (cancelamento, substituição)
 *
 * Autenticação por mTLS com certificado ICP-Brasil, igual à emissão. Não há caminho sem
 * certificado: para o MEI que entra só com login do portal, use o importador do portal.
 *
 * Referência: "Guia para utilização das API's do ADN", gov.br/nfse, versão 1.0 de 12/02/2026.
 */

const BASE_URL: Record<Ambiente, string> = {
  producao: "https://adn.nfse.gov.br/contribuintes",
  homologacao: "https://adn.producaorestrita.nfse.gov.br/contribuintes",
};

/** O lote do ADN traz no máximo 50 documentos por chamada. */
export const DOCS_POR_LOTE = 50;

export interface DocumentoDFe {
  nsu: number;
  chaveAcesso?: string;
  /** XML já descompactado. */
  xml: string;
}

export interface LoteDFe {
  documentos: DocumentoDFe[];
  /** Maior NSU deste lote. Serve de cursor para a próxima chamada. */
  ultimoNsu: number;
  /** true quando o lote veio cheio, ou seja, provavelmente há mais para buscar. */
  temMais: boolean;
}

export class AdnError extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(`ADN ${status}: ${mensagem}`);
  }
}

interface Opcoes {
  ambiente: Ambiente;
  cert: CertificadoA1;
}

function pedir(op: Opcoes, caminho: string): Promise<unknown> {
  const url = new URL(BASE_URL[op.ambiente] + caminho);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: "GET",
        hostname: url.hostname,
        path: url.pathname + url.search,
        pfx: op.cert.pfx,
        passphrase: op.cert.senha,
        headers: { Accept: "application/json" },
      },
      (res) => {
        const partes: Buffer[] = [];
        res.on("data", (c) => partes.push(c));
        res.on("end", () => {
          const corpo = Buffer.concat(partes).toString("utf8");
          const status = res.statusCode ?? 0;
          // 204 significa "não há documentos novos", que é fim de paginação, não erro.
          if (status === 204) return resolve(null);
          if (status < 200 || status >= 300) return reject(new AdnError(status, corpo.slice(0, 400)));
          try {
            resolve(corpo ? JSON.parse(corpo) : null);
          } catch {
            reject(new AdnError(status, "Resposta não é JSON"));
          }
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function descompactar(b64: string): string {
  const bruto = Buffer.from(b64, "base64");
  try {
    return zlib.gunzipSync(bruto).toString("utf8");
  } catch {
    // Alguns ambientes devolvem o XML em base64 puro, sem gzip.
    return bruto.toString("utf8");
  }
}

/**
 * Normaliza o lote. O nome exato dos campos varia entre a documentação e o que o ambiente
 * devolve na prática, então aceitamos as grafias conhecidas em vez de fixar uma só.
 */
function normalizarLote(resposta: unknown): LoteDFe {
  const vazio: LoteDFe = { documentos: [], ultimoNsu: 0, temMais: false };
  if (!resposta || typeof resposta !== "object") return vazio;
  const r = resposta as Record<string, unknown>;

  const lista =
    (r.LoteDFe as unknown[]) ?? (r.loteDFe as unknown[]) ?? (r.lote as unknown[]) ?? (r.documentos as unknown[]);
  if (!Array.isArray(lista)) return vazio;

  const documentos: DocumentoDFe[] = [];
  for (const item of lista) {
    if (!item || typeof item !== "object") continue;
    const d = item as Record<string, unknown>;
    const b64 =
      (d.ArquivoXml as string) ?? (d.arquivoXml as string) ?? (d.DocumentoXmlGZipB64 as string) ?? (d.xmlGZipB64 as string);
    if (typeof b64 !== "string" || !b64) continue;
    documentos.push({
      nsu: Number(d.NSU ?? d.nsu ?? 0),
      chaveAcesso: (d.ChaveAcesso as string) ?? (d.chaveAcesso as string),
      xml: descompactar(b64),
    });
  }

  const ultimoNsu = documentos.reduce((m, d) => Math.max(m, d.nsu), 0);
  return { documentos, ultimoNsu, temMais: documentos.length >= DOCS_POR_LOTE };
}

export const adn = {
  /** Um lote de documentos a partir do NSU informado. `cnpj` só é necessário para consultar outro CNPJ da mesma raiz. */
  async distribuicao(op: Opcoes, nsu: number, cnpj?: string): Promise<LoteDFe> {
    const q = cnpj ? `?cnpj=${cnpj}` : "";
    return normalizarLote(await pedir(op, `/DFe/${nsu}${q}`));
  },

  eventos(op: Opcoes, chaveAcesso: string) {
    return pedir(op, `/NFSe/${chaveAcesso}/Eventos`);
  },
};
