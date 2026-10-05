import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { HttpError } from "@/lib/tenant";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { parseAccessCode } from "@/lib/access-code";

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
  if (!supabaseConfigured) throw new HttpError(503, "Supabase não configurado");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (tooMany(ip)) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos." },
      { status: 429 }
    );
  }

  const { code } = await req.json();
  const parsed = typeof code === "string" ? parseAccessCode(code) : null;
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
