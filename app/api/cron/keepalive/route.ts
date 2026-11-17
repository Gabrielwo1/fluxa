import { NextRequest, NextResponse } from "next/server";
import { erpConfigured, pingDb } from "@/lib/erp/db";
import { ensureTemplate, purgeOldSandboxes } from "@/lib/erp/services/demo-sandbox";

// Mantém o banco acordado: o Supabase gratuito pausa o projeto depois de ~1 semana sem uso.
// A Vercel chama esta rota todo dia (veja "crons" em vercel.json) com o CRON_SECRET no cabeçalho.
// Não retoma um projeto que já pausou; isso é feito no painel do Supabase.
export const maxDuration = 60;

export const GET = async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!erpConfigured()) return NextResponse.json({ ok: false, error: "DATABASE_URL ausente" }, { status: 503 });
  try {
    const t0 = Date.now();
    const info = await pingDb();
    // manutenção da demonstração: apaga as cópias velhas e mantém o modelo atualizado
    const purged = await purgeOldSandboxes();
    await ensureTemplate().catch((e) => console.error("[keepalive] modelo da demo:", (e as Error).message));
    return NextResponse.json({ ok: true, ms: Date.now() - t0, ...info, demos_apagadas: purged, at: new Date().toISOString() });
  } catch (e) {
    console.error("[keepalive] falhou:", (e as Error).message);
    return NextResponse.json({ ok: false, error: "Banco indisponível. Se o projeto estiver pausado, retome no painel do Supabase." }, { status: 503 });
  }
};
