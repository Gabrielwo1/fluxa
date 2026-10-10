import type { Ambiente, Prestador, RascunhoNota, RespostaEmissao } from "./tipos";
import { gerarXmlDps, gzipBase64, gunzipBase64, montarIdDps } from "./dps";
import { assinarDps, carregarPfx, type CertificadoA1 } from "./assinatura";
import { sefin, SefinError } from "./sefin";
import { emitirPeloPortal } from "./portal";

/**
 * Camada de emissão. Três estratégias, mesma interface:
 *
 *  - "sefin":     API oficial com certificado A1 (qualquer regime, inclusive MEI com certificado).
 *  - "portal":    automação do Emissor Nacional web com login/senha (MEI sem certificado). Experimental.
 *  - "a3":        cadastrado, mas sem emissão: a chave mora no token e só assina na máquina do usuário.
 *  - "simulacao": não fala com o governo; gera o XML e devolve uma chave fictícia. Usado em dev/demonstração.
 *
 * A estratégia é escolhida pelas variáveis de ambiente (ver .env.example).
 */

export interface ContextoEmissao {
  prestador: Prestador;
  nota: RascunhoNota;
  numeroDps: number;
}

export interface Emissor {
  readonly modo: "sefin" | "portal" | "simulacao";
  emitir(ctx: ContextoEmissao): Promise<RespostaEmissao>;
}

export class EmissorSimulacao implements Emissor {
  readonly modo = "simulacao" as const;
  async emitir({ prestador, nota, numeroDps }: ContextoEmissao): Promise<RespostaEmissao> {
    const xml = gerarXmlDps({ prestador, nota, numeroDps, ambiente: "homologacao" });
    const id = montarIdDps(prestador, numeroDps);
    return {
      ok: true,
      modo: "simulacao",
      chaveAcesso: "SIM" + id.slice(3, 45).padEnd(47, "0"),
      dataProcessamento: new Date().toISOString(),
      xmlNfse: xml,
    };
  }
}

export class EmissorSefin implements Emissor {
  readonly modo = "sefin" as const;
  constructor(
    private cert: CertificadoA1,
    private ambiente: Ambiente,
  ) {}

  async emitir({ prestador, nota, numeroDps }: ContextoEmissao): Promise<RespostaEmissao> {
    const xml = gerarXmlDps({ prestador, nota, numeroDps, ambiente: this.ambiente });
    const assinado = assinarDps(xml, this.cert);
    const op = { ambiente: this.ambiente, cert: this.cert };
    try {
      const r = await sefin.emitir(op, gzipBase64(assinado));
      // O PDF não vem mais do governo: a API de DANFSe foi desligada em agosto de 2026 (NT 008/2026).
      // Ele é gerado a partir do XML em /api/notas/[id]/danfse.
      return {
        ok: true,
        modo: "sefin",
        chaveAcesso: r.chaveAcesso,
        dataProcessamento: r.dataHoraProcessamento,
        xmlNfse: gunzipBase64(r.nfseXmlGZipB64),
      };
    } catch (e) {
      if (e instanceof SefinError) return { ok: false, modo: "sefin", erros: e.erros };
      throw e;
    }
  }
}

export class EmissorPortal implements Emissor {
  readonly modo = "portal" as const;
  constructor(
    private login: string,
    private senha: string,
  ) {}

  async emitir(ctx: ContextoEmissao): Promise<RespostaEmissao> {
    return emitirPeloPortal({ login: this.login, senha: this.senha, ...ctx });
  }
}

export interface ConfigEmissao {
  modo: "simulacao" | "sefin" | "portal" | "a3";
  ambiente: Ambiente;
  pfxBase64?: string;
  senhaPfx?: string;
  loginPortal?: string;
  senhaPortal?: string;
}

/** Fábrica: escolhe o emissor a partir da configuração do prestador (banco) ou, na falta, do .env. */
export function criarEmissor(cfg?: ConfigEmissao): Emissor {
  const c: ConfigEmissao = cfg ?? {
    modo: (process.env.NFSE_MODO as ConfigEmissao["modo"]) ?? "simulacao",
    ambiente: process.env.NFSE_AMBIENTE === "producao" ? "producao" : "homologacao",
    pfxBase64: process.env.NFSE_CERT_PFX_BASE64,
    senhaPfx: process.env.NFSE_CERT_SENHA,
    loginPortal: process.env.NFSE_PORTAL_LOGIN,
    senhaPortal: process.env.NFSE_PORTAL_SENHA,
  };

  if (c.modo === "sefin") {
    if (!c.pfxBase64 || !c.senhaPfx) throw new Error("Modo certificado exige o arquivo .pfx e a senha. Configure em Emissão.");
    return new EmissorSefin(carregarPfx(c.pfxBase64, c.senhaPfx), c.ambiente);
  }
  if (c.modo === "portal") {
    if (!c.loginPortal || !c.senhaPortal) throw new Error("Modo portal exige login e senha do Emissor Nacional. Configure em Emissão.");
    return new EmissorPortal(c.loginPortal, c.senhaPortal);
  }
  // O A3 assina dentro do token, na máquina do usuário. Como o servidor não alcança a chave,
  // a recusa vem aqui, antes de reservar número de DPS, e diz o que dá para fazer no lugar.
  if (c.modo === "a3") {
    throw new Error(
      "O certificado A3 assina dentro do token, no seu computador, e o app ainda não faz essa parte. " +
        "Para emitir agora, use a senha do Emissor Nacional (MEI / Portal) ou um certificado A1 em arquivo.",
    );
  }
  return new EmissorSimulacao();
}
