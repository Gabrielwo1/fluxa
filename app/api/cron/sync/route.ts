import { NextRequest, NextResponse } from "next/server";
import { erpConfigured } from "@/lib/erp/db";
import { syncTenants } from "@/lib/erp/connectors/config";
import { syncTenant } from "@/lib/erp/services/sync";

// Chamada pelo agendador da Vercel a cada poucas horas (veja "crons" em vercel.json), com o CRON_SECRET.
// Busca nas origens de cada empresa configurada (atendente, Mercado Livre, loja) o que mudou.
export const maxDuration = 300;

export const GET = async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!erpConfigured()) return NextResponse.json({ ok: false, error: "DATABASE_URL ausente" }, { status: 503 });
  const tenants = syncTenants();
  const out: Record<string, unknown> = {};
  // repartem os 5 minutos da função; quem não terminar continua na próxima rodada
  const budgetMs = Math.floor(240_000 / Math.max(tenants.length, 1));
  for (const t of tenants) out[t] = await syncTenant(t, { budgetMs }).catch((e: Error) => ({ error: e.message }));
  return NextResponse.json({ ok: true, at: new Date().toISOString(), tenants: out });
};
