// Modo MVP sem banco de dados: o código de acesso e os itens do cliente vêm de variáveis de
// ambiente (só no servidor), e a sessão é um cookie assinado. Serve para testar com um cliente
// antes de o Supabase estar no ar. Acesso somente leitura.
//
//   SESSION_SECRET=<texto aleatório longo>
//   MVP_ACCESS_CODE_MOTTA=codigo1,codigo2     (vários códigos por cliente, separados por vírgula)
//   MVP_ITEMS_MOTTA=<itemId>,<itemId>         (conexões da Pluggy desse cliente)
//   MVP_CLIENT_NAME_MOTTA=Motta               (opcional)
//
// Usa só Web Crypto, então roda no proxy (edge) e nas rotas.

export const MVP_COOKIE = "fluxa_mvp";
export const MVP_SESSION_DAYS = 7;

const enc = new TextEncoder();
const PREFIX = "MVP_ACCESS_CODE_";

const toSlug = (suffix: string) => suffix.toLowerCase().replace(/_/g, "-");
const toSuffix = (slug: string) => slug.toUpperCase().replace(/[^A-Z0-9]/g, "_");

function clientSlugs(): string[] {
  return Object.keys(process.env)
    .filter((k) => k.startsWith(PREFIX) && process.env[k])
    .map((k) => toSlug(k.slice(PREFIX.length)));
}

export function mvpConfigured(): boolean {
  return Boolean(process.env.SESSION_SECRET && clientSlugs().length > 0);
}

export function mvpItems(slug: string): string[] {
  return (process.env[`MVP_ITEMS_${toSuffix(slug)}`] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function mvpClientName(slug: string): string {
  return (
    process.env[`MVP_CLIENT_NAME_${toSuffix(slug)}`] ||
    slug.charAt(0).toUpperCase() + slug.slice(1)
  );
}

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const unb64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(process.env.SESSION_SECRET ?? ""),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// compara pelo hash SHA-256, sem diferença de tempo conforme o quanto acertou
async function sameSecret(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// devolve o slug do cliente dono do código, ou null. Ignora maiúsculas e espaços nas pontas.
export async function matchCode(input: string): Promise<string | null> {
  const typed = input.trim().toLowerCase();
  if (!typed) return null;
  let found: string | null = null;
  for (const slug of clientSlugs()) {
    const codes = (process.env[`${PREFIX}${toSuffix(slug)}`] ?? "").split(",");
    for (const c of codes) {
      const code = c.trim().toLowerCase();
      if (code && (await sameSecret(typed, code))) found = slug;
    }
  }
  return found;
}

export async function signSession(slug: string): Promise<string> {
  const payload = b64url(
    enc.encode(JSON.stringify({ slug, exp: Date.now() + MVP_SESSION_DAYS * 86_400_000 }))
  );
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

export async function readSession(token?: string | null): Promise<{ slug: string } | null> {
  if (!token || !process.env.SESSION_SECRET) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(), unb64url(sig), enc.encode(payload));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(unb64url(payload)));
    if (typeof data.slug !== "string" || data.exp < Date.now()) return null;
    return clientSlugs().includes(data.slug) ? { slug: data.slug } : null;
  } catch {
    return null;
  }
}
