import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Cifra segredos (PFX, senhas) antes de gravar no banco. AES-256-GCM.
 * Chave: CREDENCIAIS_CHAVE, 32 bytes em base64. Gere com:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */
function chave(): Buffer {
  const b64 = process.env.CREDENCIAIS_CHAVE;
  if (!b64) throw new Error("CREDENCIAIS_CHAVE não configurada");
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("CREDENCIAIS_CHAVE deve ter 32 bytes em base64");
  return k;
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const enc = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decifrar(blob: string): string {
  const [iv, tag, enc] = blob.split(".").map((s) => Buffer.from(s, "base64"));
  const d = createDecipheriv("aes-256-gcm", chave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
