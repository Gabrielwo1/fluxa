const BASE = "https://api.pluggy.ai";

export type PluggyCreds = { clientId: string; clientSecret: string };

// Cada cliente pode ter a própria aplicação da Pluggy (conta própria no Dashboard):
// PLUGGY_CLIENT_ID_<SLUG> e PLUGGY_CLIENT_SECRET_<SLUG>, com o slug em maiúsculas
// (ex.: "motta" -> PLUGGY_CLIENT_ID_MOTTA). Sem as duas, vale a aplicação padrão.
export function credsFor(slug?: string | null): PluggyCreds {
  const suffix = slug ? slug.toUpperCase().replace(/[^A-Z0-9]/g, "_") : "";
  const ownId = suffix ? process.env[`PLUGGY_CLIENT_ID_${suffix}`] : undefined;
  const ownSecret = suffix ? process.env[`PLUGGY_CLIENT_SECRET_${suffix}`] : undefined;
  if (ownId && ownSecret) return { clientId: ownId, clientSecret: ownSecret };
  return {
    clientId: process.env.PLUGGY_CLIENT_ID ?? "",
    clientSecret: process.env.PLUGGY_CLIENT_SECRET ?? "",
  };
}

export function hasOwnCreds(slug?: string | null): boolean {
  if (!slug) return false;
  const suffix = slug.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return Boolean(
    process.env[`PLUGGY_CLIENT_ID_${suffix}`] && process.env[`PLUGGY_CLIENT_SECRET_${suffix}`]
  );
}

// a chave de API vale 2h; guarda uma por aplicação e renova com folga aos 90min
const cache = new Map<string, { key: string; exp: number }>();

export async function getApiKey(creds: PluggyCreds = credsFor()): Promise<string> {
  const hit = cache.get(creds.clientId);
  if (hit && Date.now() < hit.exp) return hit.key;
  const res = await fetch(`${BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
  });
  if (!res.ok) throw new Error(`Pluggy auth failed: ${res.status}`);
  const { apiKey } = await res.json();
  cache.set(creds.clientId, { key: apiKey, exp: Date.now() + 90 * 60 * 1000 });
  return apiKey;
}

export async function pluggyFetch<T = unknown>(
  path: string,
  creds: PluggyCreds = credsFor()
): Promise<T> {
  const key = await getApiKey(creds);
  const res = await fetch(`${BASE}${path}`, {
    headers: { "X-API-KEY": key },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Pluggy GET ${path} -> ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export async function pluggyPost<T = unknown>(
  path: string,
  body: Record<string, unknown> = {},
  creds: PluggyCreds = credsFor()
): Promise<T> {
  const key = await getApiKey(creds);
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": key },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Pluggy POST ${path} -> ${res.status}: ${await res.text()}`);
  }
  return res.json();
}
