import type { Prestador, RascunhoNota, Ambiente } from "./tipos";

/**
 * Gera o XML da DPS (Declaração de Prestação de Serviço) no padrão nacional (leiaute 1.00).
 *
 * Referência: Manual de integração do Sistema Nacional NFS-e (gov.br/nfse).
 * O XML ainda precisa ser assinado (ver assinatura.ts) antes do envio.
 */

const NS = "http://www.sped.fazenda.gov.br/nfse";
export const VERSAO_APLICATIVO = "MeiNotaIA/0.1";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n: number): string {
  return n.toFixed(2);
}

/** Data/hora no fuso de Brasília no formato exigido (AAAA-MM-DDThh:mm:ss-03:00). */
export function agoraBrasilia(): string {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return fmt.format(d).replace(" ", "T") + "-03:00";
}

/**
 * Id da infDPS: "DPS" + cLocEmi(7) + tpInsc(1) + inscrição(14) + série(5) + nDPS(15) = 45 chars.
 * tpInsc: 1 = CPF, 2 = CNPJ.
 */
export function montarIdDps(prestador: Prestador, numeroDps: number): string {
  const tpInsc = prestador.cnpj.length === 11 ? "1" : "2";
  return (
    "DPS" +
    prestador.codigoMunicipio +
    tpInsc +
    prestador.cnpj.padStart(14, "0") +
    String(prestador.serie).padStart(5, "0") +
    String(numeroDps).padStart(15, "0")
  );
}

function opSimpNac(regime: Prestador["regime"]): "1" | "2" | "3" {
  // 1 = Não optante; 2 = Optante MEI; 3 = Optante ME/EPP
  if (regime === "MEI") return "2";
  if (regime === "SIMPLES") return "3";
  return "1";
}

export interface ParametrosDps {
  prestador: Prestador;
  nota: RascunhoNota;
  numeroDps: number;
  ambiente: Ambiente;
}

export function gerarXmlDps({ prestador, nota, numeroDps, ambiente }: ParametrosDps): string {
  const id = montarIdDps(prestador, numeroDps);
  const tpAmb = ambiente === "producao" ? "1" : "2";
  const t = nota.tomador;
  const docTomador =
    t.documento.length === 14 ? `<CNPJ>${t.documento}</CNPJ>` : `<CPF>${t.documento}</CPF>`;

  const endTomador = t.endereco
    ? `<end>
        <endNac>
          <cMun>${t.endereco.codigoMunicipio}</cMun>
          <CEP>${t.endereco.cep}</CEP>
        </endNac>
        <xLgr>${esc(t.endereco.logradouro)}</xLgr>
        <nro>${esc(t.endereco.numero)}</nro>
        ${t.endereco.complemento ? `<xCpl>${esc(t.endereco.complemento)}</xCpl>` : ""}
        <xBairro>${esc(t.endereco.bairro)}</xBairro>
      </end>`
    : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="${NS}" versao="1.00">
  <infDPS Id="${id}">
    <tpAmb>${tpAmb}</tpAmb>
    <dhEmi>${agoraBrasilia()}</dhEmi>
    <verAplic>${VERSAO_APLICATIVO}</verAplic>
    <serie>${prestador.serie}</serie>
    <nDPS>${numeroDps}</nDPS>
    <dCompet>${nota.dataCompetencia}</dCompet>
    <tpEmit>1</tpEmit>
    <cLocEmi>${prestador.codigoMunicipio}</cLocEmi>
    <prest>
      <CNPJ>${prestador.cnpj}</CNPJ>
      ${prestador.email ? `<email>${esc(prestador.email)}</email>` : ""}
      <regTrib>
        <opSimpNac>${opSimpNac(prestador.regime)}</opSimpNac>
        <regEspTrib>0</regEspTrib>
      </regTrib>
    </prest>
    <toma>
      ${docTomador}
      <xNome>${esc(t.nome)}</xNome>
      ${endTomador}
      ${t.telefone ? `<fone>${esc(t.telefone.replace(/\D/g, ""))}</fone>` : ""}
      ${t.email ? `<email>${esc(t.email)}</email>` : ""}
    </toma>
    <serv>
      <locPrest>
        <cLocPrestacao>${nota.codigoMunicipioPrestacao ?? prestador.codigoMunicipio}</cLocPrestacao>
      </locPrest>
      <cServ>
        <cTribNac>${nota.codigoTributacaoNacional}</cTribNac>
        <xDescServ>${esc(nota.descricaoServico)}</xDescServ>
      </cServ>
    </serv>
    <valores>
      ${nota.valorDesconto ? `<vDescCondIncond><vDescIncond>${money(nota.valorDesconto)}</vDescIncond></vDescCondIncond>` : ""}
      <vServPrest>
        <vServ>${money(nota.valorServico)}</vServ>
      </vServPrest>
      <trib>
        <tribMun>
          <tribISSQN>1</tribISSQN>
          <tpRetISSQN>${nota.issRetido ? "2" : "1"}</tpRetISSQN>
        </tribMun>
        <totTrib>
          <indTotTrib>0</indTotTrib>
        </totTrib>
      </trib>
    </valores>
  </infDPS>
</DPS>`;

  // Remove linhas vazias deixadas por campos opcionais e indentação (XML compacto assina melhor).
  return xml
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("");
}

export function gzipBase64(xml: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const zlib = require("zlib") as typeof import("zlib");
  return zlib.gzipSync(Buffer.from(xml, "utf8")).toString("base64");
}

export function gunzipBase64(b64: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const zlib = require("zlib") as typeof import("zlib");
  return zlib.gunzipSync(Buffer.from(b64, "base64")).toString("utf8");
}
