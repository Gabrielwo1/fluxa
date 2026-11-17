import { NextRequest, NextResponse } from "next/server";
import { erpConfigured } from "@/lib/erp/db";
import { MVP_COOKIE, mvpConfigured, signSession } from "@/lib/mvp";
import { createSandbox } from "@/lib/erp/services/demo-sandbox";
import { DEMO_HOURS } from "@/lib/demo";
import { erpRoute } from "@/lib/erp/auth";

export const maxDuration = 60;

// limite simples por IP (por instância): 6 demonstrações por hora
const hits = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 6;
}

// Abre uma demonstração: cria uma empresa fictícia só deste visitante e já entra nela.
export const POST = erpRoute(async (req: NextRequest) => {
  if (!erpConfigured() || !mvpConfigured()) {
    return NextResponse.json({ error: "A demonstração ainda não está disponível neste ambiente." }, { status: 503 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (tooMany(ip)) return NextResponse.json({ error: "Muitas tentativas. Aguarde um pouco e tente de novo." }, { status: 429 });

  const slug = await createSandbox();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(MVP_COOKIE, await signSession(slug), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEMO_HOURS * 3600,
  });
  return res;
});
