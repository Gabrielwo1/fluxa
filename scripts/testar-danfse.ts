import assert from "assert";
import { writeFileSync, mkdirSync } from "fs";
import { PDFDocument } from "pdf-lib";
import { gerarDanfse } from "../lib/nfse/danfse";
import { gerarXmlDps } from "../lib/nfse/dps";

const CHAVE = "35503082212345678000199000000000012326081234567890";

/** NFS-e como o ambiente nacional devolve: DPS assinada dentro do infNFSe. */
const NFSE = `<?xml version="1.0" encoding="UTF-8"?>
<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infNFSe Id="NFS${CHAVE}">
<xLocEmi>São Paulo</xLocEmi><xLocPrestacao>São Paulo</xLocPrestacao><nNFSe>123</nNFSe>
<cLocIncid>3550308</cLocIncid><xLocIncid>São Paulo</xLocIncid>
<xTribNac>Planejamento, confecção, manutenção e atualização de páginas eletrônicas.</xTribNac>
<verAplic>SefinNac_1.4</verAplic><ambGer>2</ambGer><tpEmis>1</tpEmis><procEmi>1</procEmi><cStat>100</cStat>
<dhProc>2026-08-14T10:22:31-03:00</dhProc><nDFSe>987654</nDFSe>
<emit><CNPJ>12345678000199</CNPJ><IM>12345678</IM><xNome>JOÃO DA SILVA DESIGN E SITES</xNome>
<enderNac><xLgr>Rua Augusta</xLgr><nro>1500</nro><xCpl>Sala 12</xCpl><xBairro>Consolação</xBairro><cMun>3550308</cMun><UF>SP</UF><CEP>01304001</CEP></enderNac>
<fone>11987654321</fone><email>joao@exemplo.com.br</email></emit>
<valores><vBC>1500.00</vBC><pAliqAplic>2.00</pAliqAplic><vISSQN>0.00</vISSQN><vTotalRet>0.00</vTotalRet><vLiq>1500.00</vLiq></valores>
<DPS versao="1.01"><infDPS Id="DPS355030821234567800019900001000000000000047">
<tpAmb>1</tpAmb><dhEmi>2026-08-14T10:21:58-03:00</dhEmi><verAplic>MeiNotaIA/0.1</verAplic><serie>1</serie><nDPS>47</nDPS>
<dCompet>2026-08-14</dCompet><tpEmit>1</tpEmit><cLocEmi>3550308</cLocEmi>
<prest><CNPJ>12345678000199</CNPJ><fone>11987654321</fone><email>joao@exemplo.com.br</email>
<regTrib><opSimpNac>2</opSimpNac><regApTribSN>1</regApTribSN><regEspTrib>0</regEspTrib></regTrib></prest>
<toma><CNPJ>11222333000181</CNPJ><xNome>PADARIA SOL NASCENTE LTDA</xNome>
<end><endNac><cMun>3550308</cMun><CEP>04567000</CEP></endNac><xLgr>Av. Paulista</xLgr><nro>900</nro><xBairro>Bela Vista</xBairro></end>
<email>financeiro@padariasol.com.br</email></toma>
<serv><locPrest><cLocPrestacao>3550308</cLocPrestacao></locPrest>
<cServ><cTribNac>010801</cTribNac><xDescServ>Desenvolvimento de site institucional responsivo com 5 páginas, formulário de contato integrado ao WhatsApp, otimização básica para buscadores e 30 dias de suporte após a entrega. Inclui configuração de domínio e certificado SSL.</xDescServ><cNBS>115011000</cNBS></cServ></serv>
<valores><vServPrest><vServ>1500.00</vServ></vServPrest>
<trib><tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>1</tpRetISSQN></tribMun><totTrib><pTotTribSN>6.00</pTotTribSN></totTrib></trib></valores>
</infDPS></DPS></infNFSe></NFSe>`;

async function paginas(bytes: Uint8Array) {
  return (await PDFDocument.load(bytes)).getPageCount();
}

async function main() {
  mkdirSync(process.argv[2] ?? "/tmp/danfse", { recursive: true });
  const dir = process.argv[2] ?? "/tmp/danfse";

  const normal = await gerarDanfse(NFSE);
  assert.equal(await paginas(normal), 1, "DANFSe tem página única");
  writeFileSync(`${dir}/normal.pdf`, normal);

  const cancelada = await gerarDanfse(NFSE, { situacao: "cancelada" });
  assert.equal(await paginas(cancelada), 1);
  writeFileSync(`${dir}/cancelada.pdf`, cancelada);

  const homolog = await gerarDanfse(NFSE.replace("<tpAmb>1</tpAmb>", "<tpAmb>2</tpAmb>"));
  writeFileSync(`${dir}/homologacao.pdf`, homolog);

  // Simulação: só a DPS, sem chave nem número.
  const dps = gerarXmlDps({
    prestador: { cnpj: "12345678000199", razaoSocial: "JOÃO DA SILVA", regime: "MEI", codigoMunicipio: "3550308", serie: 1 },
    nota: {
      tomador: { documento: "11222333000181", nome: "Padaria Sol Nascente" },
      codigoTributacaoNacional: "010801",
      descricaoServico: "Criação de site “institucional” – com emoji 🚀 que não existe em WinAnsi",
      valorServico: 1500,
      dataCompetencia: "2026-09-14",
      issRetido: false,
    },
    numeroDps: 12,
    ambiente: "homologacao",
  });
  const simulada = await gerarDanfse(dps, { simulacao: true, nomeMunicipio: (c) => (c === "3550308" ? "São Paulo" : undefined) });
  assert.equal(await paginas(simulada), 1);
  writeFileSync(`${dir}/simulacao.pdf`, simulada);

  // Descrição enorme não pode estourar a página.
  const enorme = await gerarDanfse(NFSE.replace(/<xDescServ>[^<]+/, "<xDescServ>" + "Serviço detalhado de manutenção. ".repeat(400)));
  assert.equal(await paginas(enorme), 1, "descrição longa é truncada, não cria página");

  await assert.rejects(() => gerarDanfse("<nada/>"), /DPS/, "XML sem DPS falha com mensagem clara");

  console.log(`danfse OK -> ${dir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
