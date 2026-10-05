import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { HttpError } from "@/lib/tenant";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { parseAccessCode } from "@/lib/access-code";
import {
  MVP_COOKIE,
  MVP_SESSION_DAYS,
  matchCode,
  mvpConfigured,
  signSession,
} from "@/lib/mvp";

// limite simples por IP (por instância; o Supabase Auth também limita as tentativas)
const attempts = new Map<string, number[]>();
const WINDOW_MS = 10 * 60_000;
const MAX_ATTEMPTS = 8;

function tooMany(ip: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  attempts.set(ip, recent);
  return recent.length > MAX_ATTEMPTS;
}

const INVALID = () =>
  NextResponse.json({ error: "Código inválido, expirado ou revogado." }, { status: 401 });

export const POST = route(async (req) => {
  if (!supabaseConfigured && !mvpConfigured()) {
    throw new HttpError(503, "Acesso por código não configurado");
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (tooMany(ip)) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos." },
      { status: 429 }
    );
  }

  const { code } = await req.json();
  if (typeof code !== "string" || !code.trim() || code.length > 200) return INVALID();

  // 1) modo MVP: código vindo do ambiente, sessão em cookie assinado
  if (mvpConfigured()) {
    const slug = await matchCode(code);
    if (slug) {
      const res = NextResponse.json({ ok: true });
      res.cookies.set(MVP_COOKIE, await signSession(slug), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: MVP_SESSION_DAYS * 86_400,
      });
      return res;
    }
  }

  // 2) códigos gerados (FLX-...) guardados no Supabase
  const parsed = supabaseConfigured ? parseAccessCode(code) : null;
  if (!parsed) return INVALID();

  const admin = adminClient();
  const { data: row } = await admin
    .from("access_codes")
    .select("id, user_id, expires_at")
    .eq("public_id", parsed.publicId)
    .maybeSingle();
  if (!row) return INVALID();
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return INVALID();

  const { data: user } = await admin.auth.admin.getUserById(row.user_id);
  const email = user?.user?.email;
  if (!email) return INVALID();

  // login normal no Supabase Auth: define os cookies de sessão desta resposta
  const db = await createClient();
  const { error } = await db.auth.signInWithPassword({ email, password: parsed.password });
  if (error) return INVALID();

  await admin
    .from("access_codes")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id);
  return NextResponse.json({ ok: true });
});
