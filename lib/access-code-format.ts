// Leitura e máscara do código de acesso: seguro para o navegador (sem crypto).

// Alfabeto sem 0/O, 1/I e L, para o código não ser confundido ao ser digitado ou lido.
export const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const PREFIX = "FLX";
export const PUBLIC_LEN = 4;
export const SECRET_LEN = 12;

// aceita minúsculas, espaços e traços; devolve null se não for um código válido
export function parseAccessCode(input: string): { publicId: string; password: string } | null {
  let s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.startsWith(PREFIX)) s = s.slice(PREFIX.length);
  if (s.length !== PUBLIC_LEN + SECRET_LEN) return null;
  if (![...s].every((c) => ALPHABET.includes(c))) return null;
  return { publicId: s.slice(0, PUBLIC_LEN).toLowerCase(), password: s };
}

// máscara de digitação: FLX-XXXX-XXXX-XXXX-XXXX
export function formatAccessCodeInput(input: string): string {
  let s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.startsWith(PREFIX)) s = s.slice(PREFIX.length);
  s = [...s].filter((c) => ALPHABET.includes(c)).join("").slice(0, PUBLIC_LEN + SECRET_LEN);
  const groups = s.match(/.{1,4}/g) ?? [];
  return s.length ? [PREFIX, ...groups].join("-") : "";
}
