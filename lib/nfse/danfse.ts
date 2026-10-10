import { PDFDocument, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { achar, documento, extrairChave, parser, texto } from "./xml";
import { LOGO_NFSE_PNG_BASE64 } from "./logo-nfse";
import { LIBERATION_SANS_BOLD, LIBERATION_SANS_REGULAR } from "./fontes/liberation-sans";
import { servicoPorCodigo } from "@/lib/servicos";

/**
 * DANFSe v2.0: o PDF da NFS-e, gerado a partir do XML.
 *
 * Desde agosto de 2026 a API do governo que devolvia esse PDF foi desligada, e a geração passou a
 * ser responsabilidade de cada software emissor. O leiaute segue a Nota Técnica SE/CGNFS-e 008/2026:
 * A4 retrato em página única, blocos na ordem do Anexo I, logomarca oficial, QR Code para a consulta
 * pública e marca d'água para nota cancelada ou substituída.
 *
 * Duas adaptações conscientes:
 * - A NT pede Arial nos rótulos e Microsoft Sans Serif no conteúdo, fontes proprietárias que não
 *   podemos distribuir. Embutimos a Liberation Sans (licença SIL OFL), que tem as mesmas métricas
 *   da Arial. Embutir é obrigatório: as fontes padrão do PDF não vão no arquivo, e visualizadores
 *   sem Helvetica trocam o negrito dos rótulos por fonte comum.
 * - Aplicamos as supressões permitidas no item 2.3: blocos de destinatário e intermediário ausentes
 *   viram uma linha de aviso, linhas marcadas com ** somem quando vazias, e o canhoto (opcional) não
 *   é impresso. O espaço liberado vai para a descrição do serviço e para as informações
 *   complementares, como a NT permite.
 *
 * Todas as medidas abaixo estão em centímetros, medidas a partir do topo, como na tabela 2.4.5.
 */

export type SituacaoDanfse = "normal" | "cancelada" | "substituida";

export interface OpcoesDanfse {
  situacao?: SituacaoDanfse;
  /** XML de DPS emitido em modo simulação: não tem chave nem número de NFS-e. */
  simulacao?: boolean;
  /** Resolve nome do município pelo código IBGE quando o XML não traz o nome. */
  nomeMunicipio?: (codigoIbge: string) => string | undefined;
  /** Nome do prestador para quando o XML não traz, como na DPS de simulação. */
  prestadorNome?: string;
}

// ------------------------------------------------------------------ medidas

const CM = 72 / 2.54;
const PAGINA = { largura: 21, altura: 29.7 };
const X0 = 0.3;
const LARGURA = 20.4;
const COL = [0.3, 5.41, 10.51, 15.62];
const COL_L = 5.09;
const LINHA = 0.645;
const FUNDO_Y = 29.4;
const CINZA_5 = rgb(0.95, 0.95, 0.95);
const PRETO = rgb(0, 0, 0);
const VERMELHO = rgb(1, 0, 0);
const CINZA_K35 = rgb(0.65, 0.65, 0.65);

// ------------------------------------------------------------- formatação

const vazio = "-";

function fmtDoc(d?: string) {
  if (!d) return vazio;
  const n = d.replace(/\D/g, "");
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return d;
}

/** Datas do XML já vêm com fuso. Formatamos a string, sem converter, para não deslocar o horário. */
function fmtData(s?: string) {
  if (!s) return vazio;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

function fmtDataHora(s?: string) {
  if (!s) return vazio;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6]}` : fmtData(s);
}

function fmtMoeda(v?: string) {
  if (v === undefined || v === "") return vazio;
  const n = Number(v);
  return Number.isFinite(n) ? `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : v;
}

function fmtPct(v?: string) {
  if (v === undefined || v === "") return vazio;
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : v;
}

function fmtCep(c?: string) {
  const n = (c ?? "").replace(/\D/g, "");
  return n.length === 8 ? `${n.slice(0, 5)}-${n.slice(5)}` : c || vazio;
}

function juntar(partes: (string | undefined)[], sep = " / ") {
  const p = partes.filter((x) => x && x !== vazio) as string[];
  return p.length ? p.join(sep) : vazio;
}

const TP_EMIT: Record<string, string> = { "1": "Prestador", "2": "Tomador", "3": "Intermediário" };
const C_STAT: Record<string, string> = {
  "100": "NFS-e Gerada",
  "101": "NFS-e de Substituição Gerada",
  "102": "NFS-e de Decisão Judicial ou Administrativa",
  "103": "NFS-e Avulsa",
};
const AMB_GER: Record<string, string> = { "1": "Prefeitura", "2": "Sistema Nacional NFS-e" };
const TP_AMB: Record<string, string> = { "1": "Produção", "2": "Homologação" };
const OP_SIMP: Record<string, string> = {
  "1": "Não Optante",
  "2": "Optante - MEI",
  "3": "Optante - ME/EPP",
};
const REG_AP_SN: Record<string, string> = {
  "1": "Tributos federais e municipal pelo SN",
  "2": "Federais pelo SN e ISSQN por fora do SN",
  "3": "Federais e municipal por fora do SN",
};
const REG_ESP: Record<string, string> = {
  "0": "Nenhum",
  "1": "Ato Cooperado (Cooperativa)",
  "2": "Estimativa",
  "3": "Microempresa Municipal",
  "4": "Notário ou Registrador",
  "5": "Profissional Autônomo",
  "6": "Sociedade de Profissionais",
};
const TRIB_ISSQN: Record<string, string> = {
  "1": "Operação Tributável",
  "2": "Imunidade",
  "3": "Exportação de Serviço",
  "4": "Não Incidência",
};
const RET_ISSQN: Record<string, string> = {
  "1": "Não Retido",
  "2": "Retido pelo Tomador",
  "3": "Retido pelo Intermediário",
};
const FIN_NFSE: Record<string, string> = { "0": "NFS-e regular" };

function rotulo(mapa: Record<string, string>, v?: string) {
  if (v === undefined || v === "") return vazio;
  return mapa[v] ?? v;
}

// ------------------------------------------------------------ extração

interface Parte {
  documento: string;
  im: string;
  telefone: string;
  nome: string;
  municipioUf: string;
  ibgeCep: string;
  endereco: string;
  email: string;
}

interface DadosDanfse {
  chave: string;
  numero: string;
  competencia: string;
  dataHoraNfse: string;
  numeroDps: string;
  serieDps: string;
  dataHoraDps: string;
  emitente: string;
  situacao: string;
  finalidade: string;
  cabecalhoMunicipio: string;
  ambienteGerador: string;
  tipoAmbiente: string;
  homologacao: boolean;
  prestador: Parte & { simples: string; regimeSn: string };
  tomador: Parte | null;
  destinatario: Parte | null;
  intermediario: Parte | null;
  servico: { codigo: string; nbs: string; local: string; descricaoCodigo: string; descricao: string };
  issqn: {
    tipo: string;
    incidencia: string;
    regimeEspecial: string;
    imunidade: string;
    suspensao: string;
    processo: string;
    beneficio: string;
    calculoBm: string;
    deducoes: string;
    descontoIncond: string;
    bc: string;
    aliquota: string;
    retencao: string;
    apurado: string;
  };
  federal: { irrf: string; cp: string; contribuicoes: string; pis: string; cofins: string; descricaoContrib: string };
  ibscbs: {
    cst: string;
    indicador: string;
    exclusoes: string;
    bcApos: string;
    reducoes: string;
    aliquotaIbs: string;
    aliqEfMun: string;
    valorMun: string;
    aliqEfEst: string;
    valorEst: string;
    totalIbs: string;
    aliqCbs: string;
    aliqEfCbs: string;
    totalCbs: string;
  };
  totais: {
    servico: string;
    descIncond: string;
    descCond: string;
    retencoes: string;
    liquido: string;
    ibscbs: string;
    liquidoIbscbs: string;
  };
  informacoes: string[];
  competenciaAno: number;
}

function parte(no: unknown, nomeMunicipio?: OpcoesDanfse["nomeMunicipio"]): Parte | null {
  if (!no || typeof no !== "object") return null;
  const end = achar(no, "enderNac") ?? achar(no, "end");
  const endNac = achar(end, "endNac") ?? end;
  const cMun = texto(endNac, "cMun");
  const uf = texto(endNac, "UF");
  const nomeMun = texto(no, "xMun") ?? (cMun ? nomeMunicipio?.(cMun) : undefined);
  return {
    documento: fmtDoc(documento(no)),
    im: texto(no, "IM") ?? vazio,
    telefone: texto(no, "fone") ?? vazio,
    nome: texto(no, "xNome") ?? vazio,
    municipioUf: juntar([nomeMun, uf]),
    ibgeCep: juntar([cMun, fmtCep(texto(endNac, "CEP"))]),
    endereco: juntar([texto(end, "xLgr"), texto(end, "nro"), texto(end, "xCpl"), texto(end, "xBairro")], ", "),
    email: texto(no, "email") ?? vazio,
  };
}

function filho(no: unknown, nome: string): unknown {
  return no && typeof no === "object" ? (no as Record<string, unknown>)[nome] : undefined;
}

function extrair(xml: string, op: OpcoesDanfse): DadosDanfse {
  const raiz = parser.parse(xml);
  const infNFSe = achar(raiz, "infNFSe");
  const infDPS = achar(raiz, "infDPS");
  if (!infDPS) throw new Error("XML sem DPS: não é uma NFS-e do padrão nacional");

  const emit = filho(infNFSe, "emit");
  const prest = filho(infDPS, "prest");
  const toma = filho(infDPS, "toma");
  const interm = filho(infDPS, "interm");
  const ibscbs = filho(infDPS, "IBSCBS");
  const dest = achar(ibscbs, "dest");
  const serv = filho(infDPS, "serv");
  const valoresDps = filho(infDPS, "valores");
  const valoresNfse = filho(infNFSe, "valores");
  const trib = achar(valoresDps, "trib");
  const tribMun = achar(trib, "tribMun");
  const tribFed = achar(trib, "tribFed");
  const totTrib = achar(trib, "totTrib");

  // Prestador: nome e endereço vêm do bloco emit da NFS-e; regime tributário vem da DPS.
  const baseEmit = parte(emit ?? prest, op.nomeMunicipio)!;
  const regTrib = achar(prest, "regTrib");

  const tpAmb = texto(infDPS, "tpAmb");
  const cTribNac = texto(serv, "cTribNac");
  const cTribMun = texto(serv, "cTribMun");
  const cLocPrest = texto(achar(serv, "locPrest"), "cLocPrestacao");
  const xLocPrest = texto(infNFSe, "xLocPrestacao") ?? (cLocPrest ? op.nomeMunicipio?.(cLocPrest) : undefined);
  const dCompet = texto(infDPS, "dCompet");

  const vServ = texto(achar(valoresDps, "vServPrest"), "vServ");
  const vDescIncond = texto(achar(valoresDps, "vDescCondIncond"), "vDescIncond");
  const vDescCond = texto(achar(valoresDps, "vDescCondIncond"), "vDescCond");
  const vLiq = texto(valoresNfse, "vLiq");
  const vTotalRet = texto(valoresNfse, "vTotalRet");
  const vIbsCbs = texto(achar(ibscbs, "totCIBS") ?? ibscbs, "vTotNF", "vIBSCBS");

  const informacoes: string[] = [];
  const infoCompl = texto(serv, "xInfComp") ?? texto(achar(infDPS, "infoCompl"), "xInfComp");
  if (infoCompl) informacoes.push(infoCompl);
  const vTot = achar(totTrib, "vTotTrib");
  const pTot = achar(totTrib, "pTotTrib");
  if (vTot) {
    informacoes.push(
      `Totais Aproximados dos Tributos cfe. Lei nº 12.741/2012: Federais: ${fmtMoeda(texto(vTot, "vTotTribFed"))}; Estaduais: ${fmtMoeda(texto(vTot, "vTotTribEst"))}; Municipais: ${fmtMoeda(texto(vTot, "vTotTribMun"))}`,
    );
  } else if (pTot) {
    informacoes.push(
      `Totais Aproximados dos Tributos cfe. Lei nº 12.741/2012: Federais: ${fmtPct(texto(pTot, "pTotTribFed"))}; Estaduais: ${fmtPct(texto(pTot, "pTotTribEst"))}; Municipais: ${fmtPct(texto(pTot, "pTotTribMun"))}`,
    );
  } else if (texto(totTrib, "pTotTribSN")) {
    informacoes.push(`Totais Aproximados dos Tributos cfe. Lei nº 12.741/2012: ${fmtPct(texto(totTrib, "pTotTribSN"))} (Simples Nacional)`);
  }

  const cLocEmi = texto(infDPS, "cLocEmi");
  const xLocEmi = texto(infNFSe, "xLocEmi") ?? (cLocEmi ? op.nomeMunicipio?.(cLocEmi) : undefined);
  const ufEmi = texto(achar(emit, "enderNac"), "UF");

  const chave = extrairChave(raiz);
  const desconto = Number(vDescIncond ?? 0) + Number(vDescCond ?? 0);
  const liquidoCalculado = vServ ? String(Number(vServ) - desconto - Number(vTotalRet ?? 0)) : undefined;

  return {
    chave: chave ?? (op.simulacao ? "Não gerada: nota de simulação" : vazio),
    numero: texto(infNFSe, "nNFSe") ?? vazio,
    competencia: fmtData(dCompet),
    dataHoraNfse: fmtDataHora(texto(infNFSe, "dhProc")),
    numeroDps: texto(infDPS, "nDPS") ?? vazio,
    serieDps: texto(infDPS, "serie") ?? vazio,
    dataHoraDps: fmtDataHora(texto(infDPS, "dhEmi")),
    emitente: rotulo(TP_EMIT, texto(infDPS, "tpEmit")),
    situacao: op.simulacao ? "Simulação" : rotulo(C_STAT, texto(infNFSe, "cStat")),
    finalidade: rotulo(FIN_NFSE, texto(ibscbs, "finNFSe") ?? "0"),
    // Item 2.4.5: não exibir o município quando o item do código de tributação for 99.
    cabecalhoMunicipio: cTribNac?.startsWith("99") ? "" : `Município: ${juntar([xLocEmi, ufEmi])}`,
    ambienteGerador: op.simulacao ? "Nota MEI IA (simulação)" : rotulo(AMB_GER, texto(infNFSe, "ambGer")),
    tipoAmbiente: rotulo(TP_AMB, tpAmb),
    homologacao: tpAmb === "2",
    prestador: {
      ...baseEmit,
      nome: baseEmit.nome !== vazio ? baseEmit.nome : (op.prestadorNome ?? vazio),
      telefone: texto(prest, "fone") ?? baseEmit.telefone,
      email: texto(prest, "email") ?? baseEmit.email,
      simples: rotulo(OP_SIMP, texto(regTrib, "opSimpNac")),
      regimeSn: rotulo(REG_AP_SN, texto(regTrib, "regApTribSN")),
    },
    tomador: parte(toma, op.nomeMunicipio),
    destinatario: parte(dest, op.nomeMunicipio),
    intermediario: parte(interm, op.nomeMunicipio),
    servico: {
      codigo: juntar([cTribNac, cTribMun]),
      nbs: texto(serv, "cNBS") ?? vazio,
      local: juntar([xLocPrest, texto(achar(serv, "locPrest"), "cPaisPrestacao")]),
      descricaoCodigo:
        texto(infNFSe, "xTribMun") ?? texto(infNFSe, "xTribNac") ?? (cTribNac ? servicoPorCodigo(cTribNac)?.descricao : undefined) ?? vazio,
      descricao: texto(serv, "xDescServ") ?? vazio,
    },
    issqn: {
      tipo: rotulo(TRIB_ISSQN, texto(tribMun, "tribISSQN")),
      incidencia: juntar([texto(infNFSe, "xLocIncid"), texto(tribMun, "cPaisResult")]),
      regimeEspecial: rotulo(REG_ESP, texto(regTrib, "regEspTrib")),
      imunidade: texto(tribMun, "tpImunidade") ?? vazio,
      suspensao: texto(achar(tribMun, "exigSusp"), "tpSusp") ?? vazio,
      processo: texto(achar(tribMun, "exigSusp"), "nProcesso") ?? vazio,
      beneficio: texto(achar(tribMun, "BM"), "nBM") ?? vazio,
      calculoBm: fmtMoeda(texto(valoresNfse, "vCalcBM")),
      deducoes: fmtMoeda(texto(valoresNfse, "vCalcDR") ?? texto(achar(valoresDps, "vDedRed"), "vDR")),
      descontoIncond: fmtMoeda(vDescIncond),
      bc: fmtMoeda(texto(valoresNfse, "vBC")),
      aliquota: fmtPct(texto(valoresNfse, "pAliqAplic") ?? texto(tribMun, "pAliq")),
      retencao: rotulo(RET_ISSQN, texto(tribMun, "tpRetISSQN")),
      apurado: fmtMoeda(texto(valoresNfse, "vISSQN")),
    },
    federal: {
      irrf: fmtMoeda(texto(tribFed, "vRetIRRF")),
      cp: fmtMoeda(texto(tribFed, "vRetCP")),
      contribuicoes: fmtMoeda(texto(tribFed, "vRetCSLL")),
      pis: fmtMoeda(texto(achar(tribFed, "piscofins"), "vPis")),
      cofins: fmtMoeda(texto(achar(tribFed, "piscofins"), "vCofins")),
      descricaoContrib: texto(achar(tribFed, "piscofins"), "tpRetPisCofins") ?? vazio,
    },
    ibscbs: {
      cst: juntar([texto(ibscbs, "CST"), texto(ibscbs, "cClassTrib")]),
      indicador: juntar([texto(ibscbs, "cIndOp"), texto(ibscbs, "cLocalidadeIncid"), texto(ibscbs, "xLocalidadeIncid")]),
      exclusoes: fmtMoeda(texto(ibscbs, "vExcBC")),
      bcApos: fmtMoeda(texto(ibscbs, "vBCIBSCBS")),
      reducoes: juntar([fmtPct(texto(ibscbs, "pRedAliqIBS")), fmtPct(texto(ibscbs, "pRedAliqCBS"))]),
      aliquotaIbs: juntar([fmtPct(texto(ibscbs, "pIBSUF")), fmtPct(texto(ibscbs, "pIBSMun"))]),
      aliqEfMun: fmtPct(texto(ibscbs, "pAliqEfetMun")),
      valorMun: fmtMoeda(texto(ibscbs, "vIBSMun")),
      aliqEfEst: fmtPct(texto(ibscbs, "pAliqEfetUF")),
      valorEst: fmtMoeda(texto(ibscbs, "vIBSUF")),
      totalIbs: fmtMoeda(texto(ibscbs, "vIBSTot")),
      aliqCbs: fmtPct(texto(ibscbs, "pCBS")),
      aliqEfCbs: fmtPct(texto(ibscbs, "pAliqEfetCBS")),
      totalCbs: fmtMoeda(texto(ibscbs, "vCBS")),
    },
    totais: {
      servico: fmtMoeda(vServ),
      descIncond: fmtMoeda(vDescIncond),
      descCond: fmtMoeda(vDescCond),
      retencoes: fmtMoeda(vTotalRet),
      liquido: fmtMoeda(vLiq ?? liquidoCalculado),
      ibscbs: fmtMoeda(vIbsCbs),
      liquidoIbscbs: fmtMoeda(vLiq ? String(Number(vLiq) + Number(vIbsCbs ?? 0)) : liquidoCalculado),
    },
    informacoes,
    competenciaAno: Number(dCompet?.slice(0, 4) ?? 0),
  };
}

// --------------------------------------------------------------- desenho

/**
 * Mantemos o texto no conjunto WinAnsi, que cobre todo o português. A fonte embutida não tem
 * emoji nem símbolos exóticos, que sairiam como quadrados vazios, então trocamos aspas
 * tipográficas e substituímos o que não tiver representação.
 */
const EXTRA_WINANSI = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
function winAnsi(s: string): string {
  let out = "";
  for (const ch of s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ")) {
    const c = ch.charCodeAt(0);
    if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || EXTRA_WINANSI.has(ch)) out += ch;
    else {
      const semAcento = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      out += /^[\x20-\x7e]$/.test(semAcento) ? semAcento : "?";
    }
  }
  return out;
}

interface Pincel {
  pagina: PDFPage;
  normal: PDFFont;
  negrito: PDFFont;
}

const pt = (cm: number) => cm * CM;
const yPdf = (cmDoTopo: number) => pt(PAGINA.altura - cmDoTopo);

function caber(texto: string, fonte: PDFFont, tamanho: number, larguraCm: number): string {
  const t = winAnsi(texto);
  const max = pt(larguraCm);
  if (fonte.widthOfTextAtSize(t, tamanho) <= max) return t;
  let corte = t;
  while (corte.length > 1 && fonte.widthOfTextAtSize(corte + "...", tamanho) > max) corte = corte.slice(0, -1);
  return corte + "...";
}

function quebrar(texto: string, fonte: PDFFont, tamanho: number, larguraCm: number): string[] {
  const max = pt(larguraCm);
  const linhas: string[] = [];
  for (const paragrafo of winAnsi(texto).split(/\n/)) {
    let atual = "";
    for (const palavra of paragrafo.split(" ")) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (fonte.widthOfTextAtSize(tentativa, tamanho) <= max) atual = tentativa;
      else {
        if (atual) linhas.push(atual);
        atual = fonte.widthOfTextAtSize(palavra, tamanho) > max ? caber(palavra, fonte, tamanho, larguraCm) : palavra;
      }
    }
    linhas.push(atual);
  }
  return linhas;
}

function texto_(p: Pincel, s: string, xCm: number, baseCm: number, tam: number, negrito = false, cor = PRETO) {
  p.pagina.drawText(winAnsi(s), { x: pt(xCm), y: yPdf(baseCm), size: tam, font: negrito ? p.negrito : p.normal, color: cor });
}

function linhaHorizontal(p: Pincel, yCm: number) {
  p.pagina.drawLine({ start: { x: pt(X0), y: yPdf(yCm) }, end: { x: pt(X0 + LARGURA), y: yPdf(yCm) }, thickness: 0.5, color: PRETO });
}

function sombrear(p: Pincel, xCm: number, yCm: number, lCm: number, aCm: number) {
  p.pagina.drawRectangle({ x: pt(xCm), y: yPdf(yCm + aCm), width: pt(lCm), height: pt(aCm), color: CINZA_5 });
}

const PAD = 0.1;

/** Célula comum: rótulo 6pt em negrito e conteúdo 7pt, com truncamento por reticências. */
function celula(p: Pincel, col: number, yCm: number, rotuloCampo: string, valor: string, span = 1, rotuloMaiusculo = false) {
  const x = COL[col] + PAD;
  const largura = COL_L * span + (span - 1) * 0.01 - PAD * 2;
  const tamRotulo = rotuloMaiusculo ? 7 : 6;
  // Rótulo de 7pt precisa descer um pouco mais para não encostar na linha do bloco acima.
  const baseRotulo = rotuloMaiusculo ? 0.3 : 0.24;
  texto_(p, caber(rotuloCampo, p.negrito, tamRotulo, largura), x, yCm + baseRotulo, tamRotulo, true);
  texto_(p, caber(valor || vazio, p.normal, 7, largura), x, yCm + baseRotulo + 0.29, 7);
}

/** Primeira célula de cada bloco: título 7pt em caixa alta sobre fundo cinza. */
function tituloBloco(p: Pincel, yCm: number, titulo: string, altura = LINHA) {
  sombrear(p, COL[0], yCm, COL_L, altura);
  texto_(p, caber(titulo.toUpperCase(), p.negrito, 7, COL_L - PAD * 2), COL[0] + PAD, yCm + 0.3, 7, true);
}

function blocoParte(
  p: Pincel,
  yCm: number,
  titulo: string,
  dados: Parte | null,
  mensagemAusente: string,
  op: { semIm?: boolean; extra?: (y: number) => void; linhasExtras?: number },
): number {
  linhaHorizontal(p, yCm);
  if (!dados) {
    tituloBloco(p, yCm, titulo);
    texto_(p, caber(mensagemAusente, p.negrito, 7, LARGURA - COL_L - PAD * 2), COL[1] + PAD, yCm + 0.38, 7, true);
    return yCm + LINHA;
  }
  tituloBloco(p, yCm, titulo);
  celula(p, 1, yCm, "CNPJ / CPF / NIF", dados.documento);
  if (!op.semIm) celula(p, 2, yCm, "Indicador Municipal (Inscrição)", dados.im);
  celula(p, 3, yCm, "Telefone", dados.telefone);
  let y = yCm + LINHA;
  celula(p, 0, y, "Nome / Nome Empresarial", dados.nome, 2);
  celula(p, 2, y, "Município / Sigla UF", dados.municipioUf);
  celula(p, 3, y, "Código IBGE / CEP", dados.ibgeCep);
  y += LINHA;
  celula(p, 0, y, "Endereço", dados.endereco, 2);
  celula(p, 2, y, "E-mail", dados.email, 2);
  y += LINHA;
  if (op.extra) {
    op.extra(y);
    y += LINHA * (op.linhasExtras ?? 1);
  }
  return y;
}

const tudoVazio = (...v: string[]) => v.every((x) => !x || x === vazio);

export async function gerarDanfse(xml: string, opcoes: OpcoesDanfse = {}): Promise<Uint8Array> {
  const d = extrair(xml, opcoes);
  const doc = await PDFDocument.create();
  doc.setTitle(`DANFSe ${d.numero !== vazio ? d.numero : d.numeroDps}`);
  doc.setProducer("Nota MEI IA");
  doc.setCreator("Nota MEI IA");
  const pagina = doc.addPage([pt(PAGINA.largura), pt(PAGINA.altura)]);
  doc.registerFontkit(fontkit);
  const p: Pincel = {
    pagina,
    // subset: só os glifos usados vão para o arquivo, e o PDF continua pequeno.
    normal: await doc.embedFont(Buffer.from(LIBERATION_SANS_REGULAR, "base64"), { subset: true }),
    negrito: await doc.embedFont(Buffer.from(LIBERATION_SANS_BOLD, "base64"), { subset: true }),
  };

  // Moldura da página: 1 ponto.
  pagina.drawRectangle({
    x: pt(X0),
    y: yPdf(FUNDO_Y),
    width: pt(LARGURA),
    height: pt(FUNDO_Y - X0),
    borderColor: PRETO,
    borderWidth: 1,
  });

  // --------------------------------------------------------- cabeçalho
  sombrear(p, X0, 0.3, LARGURA, 1.16);
  const logo = await doc.embedPng(Buffer.from(LOGO_NFSE_PNG_BASE64, "base64"));
  const larguraLogo = 4;
  const alturaLogo = (larguraLogo * logo.height) / logo.width;
  pagina.drawImage(logo, { x: pt(0.49), y: yPdf(0.44 + alturaLogo), width: pt(larguraLogo), height: pt(alturaLogo) });

  const centroX = 5.41 + 10.19 / 2;
  const centralizar = (s: string, base: number, tam: number, cor = PRETO) => {
    const w = p.negrito.widthOfTextAtSize(winAnsi(s), tam) / CM;
    texto_(p, s, centroX - w / 2, base, tam, true, cor);
  };
  centralizar("DANFSe v2.0", 0.68, 9);
  centralizar("Documento Auxiliar da NFS-e", 1.02, 9);
  if (opcoes.simulacao) centralizar("SIMULAÇÃO - NFS-e SEM VALIDADE JURÍDICA", 1.36, 9, VERMELHO);
  else if (d.homologacao) centralizar("NFS-e SEM VALIDADE JURÍDICA", 1.36, 9, VERMELHO);

  if (d.cabecalhoMunicipio) texto_(p, caber(d.cabecalhoMunicipio, p.normal, 8, 5.0), 15.62 + PAD, 0.62, 8);
  texto_(p, caber(`Ambiente Gerador: ${d.ambienteGerador}`, p.normal, 6, 5.0), 15.62 + PAD, 1.1, 6);
  texto_(p, caber(`Tipo de Ambiente: ${d.tipoAmbiente}`, p.normal, 6, 5.0), 15.62 + PAD, 1.35, 6);

  // ----------------------------------------------------- dados da NFS-e
  linhaHorizontal(p, 1.48);
  celula(p, 0, 1.48, "CHAVE DE ACESSO DA NFS-E", d.chave, 3, true);
  celula(p, 0, 2.27, "NÚMERO DA NFS-E", d.numero, 1, true);
  celula(p, 1, 2.27, "COMPETÊNCIA DA NFS-E", d.competencia, 1, true);
  celula(p, 2, 2.27, "DATA E HORA DA EMISSÃO DA NFS-E", d.dataHoraNfse, 1, true);
  celula(p, 0, 2.96, "NÚMERO DA DPS", d.numeroDps, 1, true);
  celula(p, 1, 2.96, "SÉRIE DA DPS", d.serieDps, 1, true);
  celula(p, 2, 2.96, "DATA E HORA DA EMISSÃO DA DPS", d.dataHoraDps, 1, true);
  sombrear(p, COL[0], 3.65, COL_L, 0.67);
  celula(p, 0, 3.65, "EMITENTE DA NFS-E", d.emitente, 1, true);
  celula(p, 1, 3.65, "SITUAÇÃO DA NFS-E", d.situacao, 1, true);
  celula(p, 2, 3.65, "FINALIDADE", d.finalidade, 1, true);

  // QR Code para a consulta pública, na posição fixa do item 2.4.3.
  const QR_X = 17.48;
  const QR_Y = 1.67;
  const QR_L = 1.52;
  if (/^\d{50}$/.test(d.chave)) {
    const png = await QRCode.toBuffer(`https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${d.chave}`, {
      type: "png",
      margin: 0,
      width: 240,
      errorCorrectionLevel: "M",
    });
    const qr = await doc.embedPng(png);
    pagina.drawImage(qr, { x: pt(QR_X), y: yPdf(QR_Y + QR_L), width: pt(QR_L), height: pt(QR_L) });
    const complemento = quebrar(
      "A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e",
      p.normal,
      6,
      4.72,
    );
    complemento.slice(0, 3).forEach((l, i) => texto_(p, l, 15.8, 3.5 + i * 0.24, 6));
  } else {
    pagina.drawRectangle({
      x: pt(QR_X),
      y: yPdf(QR_Y + QR_L),
      width: pt(QR_L),
      height: pt(QR_L),
      borderColor: CINZA_K35,
      borderWidth: 0.5,
    });
    quebrar("Sem QR Code: a nota não foi autorizada pelo ambiente nacional.", p.normal, 6, 4.72)
      .slice(0, 3)
      .forEach((l, i) => texto_(p, l, 15.8, 3.5 + i * 0.24, 6));
  }

  // ------------------------------------------------- partes da operação
  let y = 4.34;
  y = blocoParte(p, y, "Prestador / Fornecedor", d.prestador, "", {
    extra: (yy) => {
      celula(p, 0, yy, "Simples Nacional na Data de Competência", d.prestador.simples);
      celula(p, 1, yy, "Regime de Apuração Tributária pelo SN", d.prestador.regimeSn, 3);
    },
  });
  y = blocoParte(p, y, "Tomador / Adquirente", d.tomador, "TOMADOR/ADQUIRENTE DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e", {});
  y = blocoParte(
    p,
    y,
    "Destinatário da Operação",
    d.destinatario,
    d.tomador ? "O DESTINATÁRIO É O PRÓPRIO TOMADOR/ADQUIRENTE DA OPERAÇÃO" : "DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e",
    { semIm: true },
  );
  y = blocoParte(p, y, "Intermediário da Operação", d.intermediario, "INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e", {});

  // Calcula a altura dos blocos fiscais para dar à descrição do serviço todo o espaço que sobrar.
  const issqnLinha2 = !tudoVazio(d.issqn.regimeEspecial === "Nenhum" ? "" : d.issqn.regimeEspecial, d.issqn.imunidade, d.issqn.suspensao, d.issqn.processo);
  const issqnLinha3 = !tudoVazio(d.issqn.beneficio, d.issqn.calculoBm, d.issqn.deducoes, d.issqn.descontoIncond);
  const imprimePisCofins = d.competenciaAno > 0 && d.competenciaAno <= 2026;
  const alturaIssqn = LINHA * (2 + (issqnLinha2 ? 1 : 0) + (issqnLinha3 ? 1 : 0));
  const alturaFederal = LINHA * (1 + (imprimePisCofins ? 1 : 0));
  const alturaIbsCbs = LINHA * 4;
  const alturaTotais = 0.67 * 2;
  const alturaInfoMinima = 0.39 + 0.9;
  const alturaServicoFixa = LINHA + 0.4;
  const espacoDescricao = FUNDO_Y - y - alturaServicoFixa - alturaIssqn - alturaFederal - alturaIbsCbs - alturaTotais - alturaInfoMinima;

  // ------------------------------------------------------------ serviço
  linhaHorizontal(p, y);
  tituloBloco(p, y, "Serviço Prestado");
  celula(p, 1, y, "Código de Tributação Nacional / Municipal", d.servico.codigo);
  celula(p, 2, y, "Código da NBS", d.servico.nbs);
  celula(p, 3, y, "Local da Prestação / Sigla UF / País", d.servico.local);
  y += LINHA;
  texto_(
    p,
    caber(`Descrição do Código de Tributação Nacional / Municipal: ${d.servico.descricaoCodigo}`, p.normal, 6, LARGURA - PAD * 2),
    X0 + PAD,
    y + 0.26,
    6,
  );
  y += 0.4;
  texto_(p, "Descrição do Serviço", COL[0] + PAD, y + 0.24, 6, true);
  const linhasDesc = quebrar(d.servico.descricao, p.normal, 7, LARGURA - PAD * 2);
  // Ocupa só o que o texto precisa (mínimo do modelo oficial). O restante fica para as
  // informações complementares, que é onde o Anexo I concentra o espaço livre.
  const alturaNecessaria = 0.3 + linhasDesc.length * 0.3 + 0.2;
  const alturaDescricao = Math.min(Math.max(1.2, alturaNecessaria), Math.max(0.63, espacoDescricao));
  const maxLinhas = Math.max(1, Math.floor((alturaDescricao - 0.3) / 0.3));
  linhasDesc.slice(0, maxLinhas).forEach((l, i) => {
    const ultima = i === maxLinhas - 1 && linhasDesc.length > maxLinhas;
    texto_(p, ultima ? caber(`${l} ...`, p.normal, 7, LARGURA - PAD * 2) : l, COL[0] + PAD, y + 0.52 + i * 0.3, 7);
  });
  y += alturaDescricao;

  // -------------------------------------------------------------- ISSQN
  linhaHorizontal(p, y);
  tituloBloco(p, y, "Tributação Municipal (ISSQN)");
  celula(p, 1, y, "Tipo de Tributação do ISSQN", d.issqn.tipo);
  celula(p, 2, y, "Município / Sigla UF / País de Incidência do ISSQN", d.issqn.incidencia, 2);
  y += LINHA;
  if (issqnLinha2) {
    celula(p, 0, y, "Regime Especial de Tributação do ISSQN", d.issqn.regimeEspecial);
    celula(p, 1, y, "Tipo de Imunidade do ISSQN", d.issqn.imunidade);
    celula(p, 2, y, "Suspensão da Exigibilidade do ISSQN", d.issqn.suspensao);
    celula(p, 3, y, "Número Processo Suspensão", d.issqn.processo);
    y += LINHA;
  }
  if (issqnLinha3) {
    celula(p, 0, y, "Benefício Municipal", d.issqn.beneficio);
    celula(p, 1, y, "Cálculo do BM", d.issqn.calculoBm);
    celula(p, 2, y, "Total Deduções/Reduções", d.issqn.deducoes);
    celula(p, 3, y, "Desconto Incondicionado", d.issqn.descontoIncond);
    y += LINHA;
  }
  celula(p, 0, y, "BC ISSQN", d.issqn.bc);
  celula(p, 1, y, "Alíquota Aplicada", d.issqn.aliquota);
  celula(p, 2, y, "Retenção do ISSQN", d.issqn.retencao);
  celula(p, 3, y, "ISSQN Apurado", d.issqn.apurado);
  y += LINHA;

  // ------------------------------------------------------------ federal
  linhaHorizontal(p, y);
  tituloBloco(p, y, "Tributação Federal (Exceto CBS)");
  celula(p, 1, y, "IRRF", d.federal.irrf);
  celula(p, 2, y, "Contribuição Previdenciária - Retida", d.federal.cp);
  celula(p, 3, y, "Contribuições Sociais - Retidas", d.federal.contribuicoes);
  y += LINHA;
  if (imprimePisCofins) {
    celula(p, 0, y, "PIS - Débito Apuração Própria", d.federal.pis);
    celula(p, 1, y, "COFINS - Débito Apuração Própria", d.federal.cofins);
    celula(p, 2, y, "Descrição Contrib. Sociais - Retidas", d.federal.descricaoContrib, 2);
    y += LINHA;
  }

  // ------------------------------------------------------------ IBS/CBS
  linhaHorizontal(p, y);
  tituloBloco(p, y, "Tributação IBS / CBS");
  celula(p, 1, y, "CST / cClassTrib", d.ibscbs.cst);
  celula(p, 2, y, "Indicador de Operação / Código IBGE Incidência / Município Incidência / Sigla UF", d.ibscbs.indicador, 2);
  y += LINHA;
  celula(p, 0, y, "Exclusões e Reduções da Base de Cálculo", d.ibscbs.exclusoes);
  celula(p, 1, y, "Base de Cálculo Após Exclusões e Reduções", d.ibscbs.bcApos);
  celula(p, 2, y, "Red. Alíquota IBS / Red. Alíquota CBS", d.ibscbs.reducoes);
  celula(p, 3, y, "Alíquota - IBS UF / IBS Mun", d.ibscbs.aliquotaIbs);
  y += LINHA;
  celula(p, 0, y, "Alíq. Efetiva Municipal - IBS", d.ibscbs.aliqEfMun);
  celula(p, 1, y, "Valor Apurado Municipal - IBS", d.ibscbs.valorMun);
  celula(p, 2, y, "Alíq. Efetiva Estadual - IBS", d.ibscbs.aliqEfEst);
  celula(p, 3, y, "Valor Apurado Estadual - IBS", d.ibscbs.valorEst);
  y += LINHA;
  celula(p, 0, y, "Valor Total Apurado - IBS", d.ibscbs.totalIbs);
  celula(p, 1, y, "Alíquota - CBS", d.ibscbs.aliqCbs);
  celula(p, 2, y, "Alíquota Efetiva - CBS", d.ibscbs.aliqEfCbs);
  celula(p, 3, y, "Valor Total Apurado - CBS", d.ibscbs.totalCbs);
  y += LINHA;

  // ------------------------------------------------------------- totais
  linhaHorizontal(p, y);
  tituloBloco(p, y, "Valor Total da NFS-e", 0.67);
  celula(p, 1, y, "VALOR DA OPERAÇÃO / SERVIÇO", d.totais.servico, 1, true);
  celula(p, 2, y, "Desconto Incondicionado", d.totais.descIncond);
  celula(p, 3, y, "Desconto Condicionado", d.totais.descCond);
  y += 0.67;
  celula(p, 0, y, "Total das Retenções (ISSQN / Federais)", d.totais.retencoes);
  celula(p, 1, y, "VALOR LÍQUIDO DA NFS-E", d.totais.liquido, 1, true);
  celula(p, 2, y, "Total do IBS/CBS", d.totais.ibscbs);
  sombrear(p, COL[3], y, X0 + LARGURA - COL[3], 0.67);
  celula(p, 3, y, "VALOR LÍQUIDO DA NFS-E + IBS/CBS", d.totais.liquidoIbscbs, 1, true);
  y += 0.67;

  // ------------------------------------------- informações complementares
  linhaHorizontal(p, y);
  texto_(p, "INFORMAÇÕES COMPLEMENTARES", X0 + PAD, y + 0.3, 7, true);
  y += 0.39;
  const informacoes = [...d.informacoes];
  if (opcoes.simulacao) {
    informacoes.unshift("Documento gerado em modo de simulação. Nada foi enviado ao Sistema Nacional NFS-e e não tem valor fiscal.");
  }
  const linhasInfo = informacoes.flatMap((i) => quebrar(i, p.normal, 7, LARGURA - PAD * 2));
  const maxInfo = Math.max(1, Math.floor((FUNDO_Y - y - 0.15) / 0.3));
  linhasInfo.slice(0, maxInfo).forEach((l, i) => texto_(p, l, X0 + PAD, y + 0.3 + i * 0.3, 7));

  // --------------------------------------------------------- marca d'água
  const marca = opcoes.situacao === "cancelada" ? "CANCELADA" : opcoes.situacao === "substituida" ? "SUBSTITUÍDA" : opcoes.simulacao ? "SIMULAÇÃO" : "";
  if (marca) {
    const tam = 90;
    const w = p.normal.widthOfTextAtSize(winAnsi(marca), tam);
    const angulo = 55;
    const rad = (angulo * Math.PI) / 180;
    const cx = pt(PAGINA.largura / 2);
    const cy = pt(PAGINA.altura / 2);
    pagina.drawText(winAnsi(marca), {
      x: cx - (w / 2) * Math.cos(rad),
      y: cy - (w / 2) * Math.sin(rad),
      size: tam,
      font: p.normal,
      color: CINZA_K35,
      rotate: degrees(angulo),
      opacity: 0.55,
    });
  }

  return doc.save();
}
