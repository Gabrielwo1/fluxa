import type { Ambiente } from "./tipos";
import { carregarPfx, type CertificadoA1 } from "./assinatura";
import { adn, AdnError } from "./adn";
import { lerNfse, XmlInvalidoError, type NotaImportada } from "./xml";
import { buscarNotasNoPortal } from "./portal-historico";

/**
 * Importação do histórico de notas que o MEI já emitiu antes de usar o app.
 *
 * O caminho depende de COMO o usuário conectou a conta, porque cada forma de acesso
 * dá acesso a uma fonte diferente:
 *
 *   certificado A1  -> API de distribuição do ADN, paginada por NSU. Oficial e estável.
 *   login do portal -> raspagem da consulta do Emissor Nacional. Único caminho sem certificado.
 *   nenhum dos dois -> o usuário envia os XML manualmente.
 *
 * Todas devolvem a mesma forma, então a rota de importação não sabe qual foi usada.
 */

export type ModoImportacao = "adn" | "portal" | "arquivo";

export interface ContextoImportacao {
  /** CNPJ do prestador, para separar o que ele emitiu do que ele recebeu. */
  cnpj: string;
  /** Cursor do ADN. Continua de onde a última importação parou. */
  ultimoNsu?: number;
  /** Conteúdo dos XML enviados, quando o modo é arquivo. */
  arquivos?: string[];
}

export interface ResultadoBusca {
  notas: NotaImportada[];
  /** Quantas vieram da fonte mas não são notas emitidas por este CNPJ (notas recebidas). */
  recebidas: number;
  /** XML que não deu para ler. */
  ilegiveis: number;
  ultimoNsu?: number;
  /** Mensagem para o usuário quando a busca parou antes do fim. */
  aviso?: string;
}

export interface Importador {
  readonly modo: ModoImportacao;
  buscar(ctx: ContextoImportacao): Promise<ResultadoBusca>;
}

/** Teto de lotes por execução. Evita estourar o limite de consultas por hora do ambiente nacional. */
const MAX_LOTES = 20;

/** Separa as notas emitidas pelo CNPJ das recebidas, descartando XML ilegível. */
function classificar(xmls: string[], cnpj: string) {
  const notas: NotaImportada[] = [];
  let recebidas = 0;
  let ilegiveis = 0;

  for (const xml of xmls) {
    try {
      const nota = lerNfse(xml);
      if (nota.prestadorDocumento === cnpj) notas.push(nota);
      else recebidas++;
    } catch (e) {
      if (e instanceof XmlInvalidoError) ilegiveis++;
      else throw e;
    }
  }
  return { notas, recebidas, ilegiveis };
}

/** Certificado A1: API oficial de distribuição do ADN. */
export class ImportadorAdn implements Importador {
  readonly modo = "adn" as const;
  constructor(
    private cert: CertificadoA1,
    private ambiente: Ambiente,
  ) {}

  async buscar(ctx: ContextoImportacao): Promise<ResultadoBusca> {
    const op = { ambiente: this.ambiente, cert: this.cert };
    const xmls: string[] = [];
    let nsu = ctx.ultimoNsu ?? 0;
    let lotes = 0;
    let aviso: string | undefined;

    while (lotes < MAX_LOTES) {
      let lote;
      try {
        lote = await adn.distribuicao(op, nsu);
      } catch (e) {
        // Sem nada novo ou limite de consultas atingido: interrompe sem perder o já lido.
        if (e instanceof AdnError && (e.status === 404 || e.status === 429)) {
          aviso =
            e.status === 429
              ? "O ambiente nacional limitou as consultas. Importamos o que deu e você pode continuar mais tarde."
              : undefined;
          break;
        }
        throw e;
      }

      if (lote.documentos.length === 0) break;
      xmls.push(...lote.documentos.map((d) => d.xml));
      nsu = lote.ultimoNsu;
      lotes++;
      if (!lote.temMais) break;
    }

    if (lotes >= MAX_LOTES) {
      aviso = "Trouxemos a primeira parte do histórico. Importe de novo para continuar de onde parou.";
    }

    return { ...classificar(xmls, ctx.cnpj), ultimoNsu: nsu, aviso };
  }
}

/** Login do portal: raspagem da consulta do Emissor Nacional. Único caminho sem certificado. */
export class ImportadorPortal implements Importador {
  readonly modo = "portal" as const;
  constructor(
    private login: string,
    private senha: string,
  ) {}

  async buscar(ctx: ContextoImportacao): Promise<ResultadoBusca> {
    const { xmls, aviso } = await buscarNotasNoPortal({ login: this.login, senha: this.senha });
    return { ...classificar(xmls, ctx.cnpj), aviso };
  }
}

/** XML enviados pelo usuário. Funciona em qualquer modo de conexão. */
export class ImportadorArquivo implements Importador {
  readonly modo = "arquivo" as const;

  async buscar(ctx: ContextoImportacao): Promise<ResultadoBusca> {
    return classificar(ctx.arquivos ?? [], ctx.cnpj);
  }
}

export interface ConfigImportacao {
  modoEmissao: "simulacao" | "sefin" | "portal" | "a3";
  ambiente: Ambiente;
  pfxBase64?: string;
  senhaPfx?: string;
  loginPortal?: string;
  senhaPortal?: string;
  /** Força o modo arquivo, mesmo que a conta esteja conectada por certificado ou portal. */
  arquivos?: boolean;
}

export class ImportacaoIndisponivelError extends Error {}

/** Escolhe o importador a partir de como a conta do usuário está conectada. */
export function criarImportador(cfg: ConfigImportacao): Importador {
  if (cfg.arquivos) return new ImportadorArquivo();

  if (cfg.modoEmissao === "sefin") {
    if (!cfg.pfxBase64 || !cfg.senhaPfx) {
      throw new ImportacaoIndisponivelError("Configure o certificado A1 em Perfil para importar pelo ambiente nacional.");
    }
    return new ImportadorAdn(carregarPfx(cfg.pfxBase64, cfg.senhaPfx), cfg.ambiente);
  }

  if (cfg.modoEmissao === "portal") {
    if (!cfg.loginPortal || !cfg.senhaPortal) {
      throw new ImportacaoIndisponivelError("Configure o login do Emissor Nacional em Perfil para importar.");
    }
    return new ImportadorPortal(cfg.loginPortal, cfg.senhaPortal);
  }

  throw new ImportacaoIndisponivelError(
    "No modo simulação não há conta conectada. Conecte um certificado ou o login do portal, ou envie os XML das notas.",
  );
}
