import assert from "assert";
import { lerNfse, XmlInvalidoError } from "../lib/nfse/xml";

/** NFS-e no formato que o ambiente nacional devolve: a DPS aninhada dentro da NFS-e. */
function nfseExemplo(o: {
  chave: string;
  prestadorCnpj: string;
  tomador: string;
  nome: string;
  valor: string;
  competencia: string;
  nDPS: string;
  serie: string;
}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">
  <infNFSe Id="NFS${o.chave}">
    <nNFSe>000000123</nNFSe>
    <dhProc>2026-08-14T10:22:31-03:00</dhProc>
    <emit><CNPJ>${o.prestadorCnpj}</CNPJ><xNome>MINHA EMPRESA</xNome></emit>
    <DPS>
      <infDPS Id="DPS3550308200000000000191000010000000000${o.nDPS}">
        <dhEmi>2026-08-14T09:00:00-03:00</dhEmi>
        <serie>${o.serie}</serie>
        <nDPS>${o.nDPS}</nDPS>
        <dCompet>${o.competencia}</dCompet>
        <prest><CNPJ>${o.prestadorCnpj}</CNPJ></prest>
        <toma><CNPJ>${o.tomador}</CNPJ><xNome>${o.nome}</xNome></toma>
        <serv><cServ><cTribNac>010801</cTribNac><xDescServ>Criação de site institucional</xDescServ></cServ></serv>
        <valores><vServPrest><vServ>${o.valor}</vServ></vServPrest></valores>
      </infDPS>
    </DPS>
  </infNFSe>
</NFSe>`;
}

const CHAVE = "3".repeat(50);
const nota = lerNfse(
  nfseExemplo({
    chave: CHAVE,
    prestadorCnpj: "00000000000191",
    tomador: "11222333000181",
    nome: "Padaria Sol",
    valor: "1500.00",
    competencia: "2026-08-14",
    nDPS: "47",
    serie: "1",
  }),
);

assert.equal(nota.chaveAcesso, CHAVE, "chave de acesso");
assert.equal(nota.numeroNfse, "000000123");
assert.equal(nota.valor, 1500, "valor vem de vServPrest/vServ");
assert.equal(nota.competencia, "2026-08-14");
assert.equal(nota.serie, 1);
assert.equal(nota.numeroDps, 47, "número do DPS alimenta o contador");
assert.equal(nota.prestadorDocumento, "00000000000191", "prestador é quem emitiu");
assert.equal(nota.tomadorDocumento, "11222333000181", "tomador não pode virar prestador");
assert.equal(nota.tomadorNome, "Padaria Sol");
assert.equal(nota.descricao, "Criação de site institucional");
assert.equal(nota.codigoTributacaoNacional, "010801");

// A chave também tem de sair do Id quando não existe a tag dedicada.
const semTagChave = lerNfse(
  nfseExemplo({ chave: CHAVE, prestadorCnpj: "00000000000191", tomador: "11222333000181", nome: "X", valor: "10", competencia: "2026-01-02", nDPS: "1", serie: "1" }),
);
assert.equal(semTagChave.chaveAcesso, CHAVE);

// Prefixo de namespace não pode quebrar a leitura.
const comPrefixo = lerNfse(
  nfseExemplo({ chave: CHAVE, prestadorCnpj: "00000000000191", tomador: "11222333000181", nome: "X", valor: "99.90", competencia: "2026-01-02", nDPS: "2", serie: "1" })
    .replace(/<(\/?)(infNFSe|DPS|infDPS|prest|toma|serv|valores)/g, "<$1ns2:$2"),
);
assert.equal(comPrefixo.valor, 99.9, "namespace prefixado");

// Nota emitida por outro CNPJ é uma nota recebida, não entra no faturamento.
const recebida = lerNfse(
  nfseExemplo({ chave: "4".repeat(50), prestadorCnpj: "99888777000166", tomador: "00000000000191", nome: "Eu", valor: "300", competencia: "2026-03-01", nDPS: "9", serie: "1" }),
);
assert.notEqual(recebida.prestadorDocumento, "00000000000191");

// XML sem os campos essenciais precisa falhar de forma explícita.
assert.throws(() => lerNfse("<NFSe><infNFSe/></NFSe>"), XmlInvalidoError, "sem chave");
assert.throws(() => lerNfse("não é xml <<<"), XmlInvalidoError, "texto solto");

console.log("importação OK");
