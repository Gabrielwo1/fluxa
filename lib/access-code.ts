import { randomInt } from "crypto";
import { ALPHABET, PREFIX, PUBLIC_LEN, SECRET_LEN } from "@/lib/access-code-format";

export { parseAccessCode } from "@/lib/access-code-format";

const pick = (n: number) =>
  Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

// 4 caracteres identificam o acesso (público) e 12 são o segredo: ~59 bits
export function generateAccessCode() {
  const publicId = pick(PUBLIC_LEN);
  const secret = pick(SECRET_LEN);
  const code = [PREFIX, publicId, secret.slice(0, 4), secret.slice(4, 8), secret.slice(8)].join("-");
  // a senha no Supabase Auth é o código sem prefixo e sem traços
  return { code, publicId: publicId.toLowerCase(), password: publicId + secret };
}
