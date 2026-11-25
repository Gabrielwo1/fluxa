import { erpRoute, ensureCompany, json } from "@/lib/erp/auth";
import { erpConfigured } from "@/lib/erp/db";
import { hasIngestKey, ingestTenant } from "@/lib/erp/ingest-auth";
import { ingest, SOURCES } from "@/lib/erp/services/ingest";
import { mvpClientName } from "@/lib/mvp";
import { HttpError } from "@/lib/tenant";

export const runtime = "nodejs";
export const maxDuration = 60;

// Porta de entrada dos dados que vêm de fora (atendente, loja, Mercado Livre).
// Rota pública no proxy: quem manda se identifica pela chave INGEST_KEY_<EMPRESA> (Authorization: Bearer).
const MAX_BYTES = 6_000_000;

function tenantOf(req: Request): string {
  if (!erpConfigured()) throw new HttpError(503, "O banco de dados do ERP ainda não está configurado neste ambiente (DATABASE_URL).");
  return ingestTenant(req);
}

// Teste de conexão: confirma a chave e diz de qual empresa ela é.
export const GET = erpRoute(async (req) => {
  const tenant = tenantOf(req);
  return json({ ok: true, tenant, sources: SOURCES, key_configured: hasIngestKey(tenant) });
});

export const POST = erpRoute(async (req) => {
  const tenant = tenantOf(req);
  const text = await req.text();
  if (text.length > MAX_BYTES) throw new HttpError(413, "Envio grande demais. Mande em lotes menores (até 500 itens).");
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new HttpError(400, "O corpo precisa ser um JSON válido.");
  }
  await ensureCompany(tenant, mvpClientName(tenant));
  return json(await ingest(tenant, payload));
});
