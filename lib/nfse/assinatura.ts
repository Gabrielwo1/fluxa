import forge from "node-forge";
import { SignedXml } from "xml-crypto";

/**
 * Assinatura XMLDSIG do DPS com certificado A1 (arquivo .pfx/.p12).
 * Padrão exigido pelo Sistema Nacional: RSA-SHA256, C14N, transform enveloped.
 */

export interface CertificadoA1 {
  privateKeyPem: string;
  certPem: string;
  /** Buffer do PFX original, usado no mTLS do Sefin. */
  pfx: Buffer;
  senha: string;
}

export function carregarPfx(pfxBase64: string, senha: string): CertificadoA1 {
  const pfx = Buffer.from(pfxBase64, "base64");
  const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfx.toString("binary")));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha);

  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ??
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag];
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];

  const key = keyBags?.[0]?.key;
  const cert = certBags?.[0]?.cert;
  if (!key || !cert) throw new Error("PFX inválido: chave privada ou certificado não encontrados");

  return {
    privateKeyPem: forge.pki.privateKeyToPem(key),
    certPem: forge.pki.certificateToPem(cert),
    pfx,
    senha,
  };
}

export function assinarDps(xml: string, cert: CertificadoA1): string {
  const sig = new SignedXml({
    privateKey: cert.privateKeyPem,
    publicCert: cert.certPem,
    canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    getKeyInfoContent: SignedXml.getKeyInfoContent,
  });

  sig.addReference({
    xpath: "//*[local-name(.)='infDPS']",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    ],
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
  });

  sig.computeSignature(xml, {
    location: { reference: "//*[local-name(.)='infDPS']", action: "after" },
  });

  return sig.getSignedXml();
}
