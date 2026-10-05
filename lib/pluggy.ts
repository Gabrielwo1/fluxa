const BASE = "https://api.pluggy.ai";

let cached: { key: string; exp: number } | null = null;

export async function getApiKey(): Promise<string> {
  if (cached && Date.now() < cached.exp) return cached.key;
  const res = await fetch(`${BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: process.env.PLUGGY_CLIENT_ID,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Pluggy auth failed: ${res.status}`);
  const { apiKey } = await res.json();
  // a chave vale 2h; renova com folga aos 90min
  cached = { key: apiKey, exp: Date.now() + 90 * 60 * 1000 };
  return apiKey;
}

export async function pluggyFetch<T = unknown>(path: string): Promise<T> {
  const key = await getApiKey();
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
  body: Record<string, unknown> = {}
): Promise<T> {
  const key = await getApiKey();
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
