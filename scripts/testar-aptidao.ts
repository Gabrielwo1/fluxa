import assert from "assert";
import forge from "node-forge";
import { carregarPfx } from "../lib/nfse/assinatura";
import { verificarAptidao } from "../lib/nfse/aptidao";

const { asn1 } = forge;
const chaves = forge.pki.rsa.generateKeyPair(1024);

/** subjectAltName com otherName, que é onde a ICP-Brasil grava CNPJ e CPF. */
function sanIcp(outros: [string, string][]) {
  const nomes = outros.map(([oid, valor]) =>
    asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(oid).getBytes()),
      asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, valor),
      ]),
    ]),
  );
  return asn1.toDer(asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, nomes)).getBytes();
}

function pfx(o: { cn: string; org?: string; inicio: Date; fim: Date; san?: [string, string][]; clientAuth?: boolean }) {
  const cert = forge.pki.createCertificate();
  cert.publicKey = chaves.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = o.inicio;
  cert.validity.notAfter = o.fim;
  const attrs = [{ name: "commonName", value: o.cn }, { name: "organizationName", value: o.org ?? "ICP-Brasil" }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  const ext: object[] = [
    { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
    { name: "extKeyUsage", clientAuth: o.clientAuth ?? true, emailProtection: true },
  ];
  if (o.san) ext.push({ id: "2.5.29.17", critical: false, value: sanIcp(o.san) });
  cert.setExtensions(ext);
  cert.sign(chaves.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(chaves.privateKey, [cert], "1234", { algorithm: "3des" });
  return carregarPfx(Buffer.from(asn1.toDer(p12).getBytes(), "binary").toString("base64"), "1234");
}

const DIA = 86_400_000;
const hoje = new Date();
const MEU = "12345678000199";
const op = { cnpjPrestador: MEU, ambiente: "homologacao" as const, testarConexao: false };

async function main() {
// e-CNPJ válido, da mesma empresa
const ok = await verificarAptidao(
  pfx({
    cn: "MINHA EMPRESA LTDA:12345678000199",
    inicio: new Date(hoje.getTime() - DIA),
    fim: new Date(hoje.getTime() + 365 * DIA),
    san: [
      ["2.16.76.1.3.3", MEU],
      ["2.16.76.1.3.4", "01011990" + "98765432100" + "0".repeat(26)],
    ],
  }),
  op,
);
assert.equal(ok.apto, true, `e-CNPJ válido: ${ok.problemas}`);
assert.equal(ok.tipo, "e-CNPJ");
assert.equal(ok.cnpj, MEU);
assert.equal(ok.cpf, "98765432100", "CPF do responsável");
assert.equal(ok.titular, "MINHA EMPRESA LTDA");
assert.deepEqual(ok.avisos, []);

// Filial da mesma raiz de CNPJ é aceita
const filial = await verificarAptidao(
  pfx({ cn: "MINHA EMPRESA:12345678000270", inicio: new Date(hoje.getTime() - DIA), fim: new Date(hoje.getTime() + 90 * DIA), san: [["2.16.76.1.3.3", "12345678000270"]] }),
  op,
);
assert.equal(filial.apto, true, "mesma raiz");

// Certificado de outra empresa
const outra = await verificarAptidao(
  pfx({ cn: "OUTRA:99888777000166", inicio: new Date(hoje.getTime() - DIA), fim: new Date(hoje.getTime() + 90 * DIA), san: [["2.16.76.1.3.3", "99888777000166"]] }),
  op,
);
assert.equal(outra.apto, false);
assert.match(outra.problemas.join(" "), /outra empresa/);

// Vencido
const vencido = await verificarAptidao(
  pfx({ cn: "X:12345678000199", inicio: new Date(hoje.getTime() - 400 * DIA), fim: new Date(hoje.getTime() - 5 * DIA), san: [["2.16.76.1.3.3", MEU]] }),
  op,
);
assert.equal(vencido.apto, false);
assert.match(vencido.problemas.join(" "), /venceu/);

// Perto de vencer: aviso, não bloqueio
const quase = await verificarAptidao(
  pfx({ cn: "X:12345678000199", inicio: new Date(hoje.getTime() - DIA), fim: new Date(hoje.getTime() + 12 * DIA), san: [["2.16.76.1.3.3", MEU]] }),
  op,
);
assert.equal(quase.apto, true);
assert.match(quase.avisos.join(" "), /vence em/);

// e-CPF: aviso
const pf = await verificarAptidao(
  pfx({ cn: "FULANO DE TAL:12345678901", inicio: new Date(hoje.getTime() - DIA), fim: new Date(hoje.getTime() + 90 * DIA), san: [["2.16.76.1.3.1", "01011990" + "12345678901" + "0".repeat(32)]] }),
  op,
);
assert.equal(pf.tipo, "e-CPF");
assert.equal(pf.cpf, "12345678901");
assert.equal(pf.apto, true);
assert.match(pf.avisos.join(" "), /pessoa física/);

// Fora da ICP-Brasil
const fora = await verificarAptidao(
  pfx({ cn: "X:12345678000199", org: "Minha CA Caseira", inicio: new Date(hoje.getTime() - DIA), fim: new Date(hoje.getTime() + 90 * DIA), san: [["2.16.76.1.3.3", MEU]] }),
  op,
);
assert.equal(fora.apto, false);
assert.match(fora.problemas.join(" "), /ICP-Brasil/);

// CNPJ só no CN, sem otherName
const soCn = await verificarAptidao(
  pfx({ cn: "MINHA EMPRESA:12345678000199", inicio: new Date(hoje.getTime() - DIA), fim: new Date(hoje.getTime() + 90 * DIA) }),
  op,
);
assert.equal(soCn.cnpj, MEU);
assert.equal(soCn.apto, true);

// Sem autenticação de cliente: aviso
const semClient = await verificarAptidao(
  pfx({ cn: "X:12345678000199", inicio: new Date(hoje.getTime() - DIA), fim: new Date(hoje.getTime() + 90 * DIA), san: [["2.16.76.1.3.3", MEU]], clientAuth: false }),
  op,
);
assert.match(semClient.avisos.join(" "), /autenticação de cliente/);

console.log("aptidão OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
