import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { gerarXmlDps, gzipBase64, gunzipBase64, montarIdDps } from "../lib/nfse/dps";
import { assinarDps, carregarPfx } from "../lib/nfse/assinatura";
import { SignedXml } from "xml-crypto";
import { DOMParser } from "@xmldom/xmldom";
import { XMLValidator } from "fast-xml-parser";

const prestador = {
  cnpj: "12345678000199",
  razaoSocial: "TESTE MEI LTDA",
  regime: "MEI" as const,
  codigoMunicipio: "3550308",
  serie: 1,
};
const nota = {
  tomador: {
    documento: "11222333000181",
    nome: "Cliente Exemplo & Cia",
    endereco: { logradouro: "Rua A", numero: "10", bairro: "Centro", codigoMunicipio: "3550308", cep: "01001000" },
  },
  codigoTributacaoNacional: "010801",
  descricaoServico: "Desenvolvimento de landing page <institucional>",
  valorServico: 1500,
  dataCompetencia: "2026-09-09",
  issRetido: false,
};

const xml = gerarXmlDps({ prestador, nota, numeroDps: 7, ambiente: "homologacao" });
console.log("Id:", montarIdDps(prestador, 7), "len", montarIdDps(prestador, 7).length);
console.log("XML bem formado:", XMLValidator.validate(xml) === true);

// Certificado autoassinado só para exercitar a assinatura. Gerado na hora e nunca versionado.
const PFX = "scripts/teste.pfx";
if (!existsSync(PFX)) {
  execSync(
    `openssl req -x509 -newkey rsa:2048 -keyout /tmp/t.key -out /tmp/t.crt -days 30 -nodes ` +
      `-subj "/CN=TESTE MEI LTDA:12345678000199/C=BR" 2>/dev/null && ` +
      `openssl pkcs12 -export -out ${PFX} -inkey /tmp/t.key -in /tmp/t.crt -passout pass:1234 -legacy 2>/dev/null || ` +
      `openssl pkcs12 -export -out ${PFX} -inkey /tmp/t.key -in /tmp/t.crt -passout pass:1234; ` +
      `rm -f /tmp/t.key /tmp/t.crt`,
    { shell: "/bin/bash" },
  );
}
const cert = carregarPfx(readFileSync(PFX).toString("base64"), "1234");
const assinado = assinarDps(xml, cert);
console.log("Tem Signature:", assinado.includes("<Signature") && assinado.includes("X509Certificate"));

// Verifica a assinatura com a chave pública
const doc = new DOMParser().parseFromString(assinado, "text/xml");
const sigNode = doc.getElementsByTagNameNS("http://www.w3.org/2000/09/xmldsig#", "Signature")[0];
const v = new SignedXml({ publicCert: cert.certPem });
v.loadSignature(sigNode as unknown as Node);
console.log("Assinatura válida:", v.checkSignature(assinado));

const b64 = gzipBase64(assinado);
console.log("gzip+base64 ok:", gunzipBase64(b64) === assinado, "bytes:", b64.length);
console.log("\n" + assinado.slice(0, 600) + "…");
