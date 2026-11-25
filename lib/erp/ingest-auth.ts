import { createHash, timingSafeEqual } from "node:crypto";
import { HttpError } from "@/lib/tenant";

// Chave de integração de cada empresa: INGEST_KEY_<SLUG> (várias separadas por vírgula, para trocar sem parar).
// Quem envia dados (atendente, loja, scripts) manda "Authorization: Bearer <chave>"; a chave diz de qual
// empresa são os dados, então o corpo do pedido nunca escolhe o tenant.
const PREFIX = "INGEST_KEY_";
const MIN_LENGTH = 24;

const digest = (v: string) => createHash("sha256").update(v).digest();

function keys(): { tenant: string; digest: Buffer }[] {
  const out: { tenant: string; digest: Buffer }[] = [];
  for (const [name, value] of Object.entries(process.env)) {
    if (!name.startsWith(PREFIX) || !value) continue;
    const tenant = name.slice(PREFIX.length).toLowerCase();
    for (const k of value.split(",").map((s) => s.trim())) {
      if (k.length >= MIN_LENGTH) out.push({ tenant, digest: digest(k) });
    }
  }
  return out;
}

// O slug da empresa é só letras e números (scripts/novo-cliente.sh), então o sufixo da variável é o próprio slug.
export const hasIngestKey = (tenant: string) => keys().some((k) => k.tenant === tenant.toLowerCase());

export function ingestTenant(req: Request): string {
  const sent = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1]?.trim();
  if (!sent) throw new HttpError(401, "Envie a chave de integração em Authorization: Bearer.");
  const d = digest(sent);
  let found: string | null = null;
  // percorre todas as chaves, sem parar na primeira, para o tempo de resposta não revelar nada
  for (const k of keys()) if (timingSafeEqual(k.digest, d) && !found) found = k.tenant;
  if (!found) throw new HttpError(401, "Chave de integração inválida.");
  return found;
}
