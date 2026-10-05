import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { HttpError, getTenant, type Role } from "@/lib/tenant";
import { adminClient, accessEmail } from "@/lib/supabase/admin";
import { generateAccessCode } from "@/lib/access-code";

const ROLES: Role[] = ["viewer", "editor", "owner"];
const VALIDITY_DAYS = [0, 7, 30, 90, 365]; // 0 = sem validade

async function requireStaff() {
  const t = await getTenant();
  if (t.mode !== "supabase") throw new HttpError(503, "Disponível só com o Supabase configurado");
  if (!t.isStaff) throw new HttpError(403, "Apenas a equipe gerencia acessos");
  return t;
}

export const GET = route(async () => {
  const t = await requireStaff();
  const { data, error } = await t
    .db!.from("access_codes")
    .select("id, public_id, label, role, created_at, expires_at, last_used_at")
    .eq("client_id", t.clientId)
    .order("created_at", { ascending: false });
  if (error) throw new HttpError(500, error.message);
  return NextResponse.json({ codes: data ?? [] });
});

// cria o acesso e devolve o código UMA vez (ele não fica salvo em lugar nenhum)
export const POST = route(async (req) => {
  const t = await requireStaff();
  const body = await req.json();
  const role = body.role as Role;
  const days = Number(body.days ?? 0);
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 120) : "";
  if (!ROLES.includes(role)) throw new HttpError(400, "Papel inválido");
  if (!VALIDITY_DAYS.includes(days)) throw new HttpError(400, "Validade inválida");

  const admin = adminClient();
  const { code, publicId, password } = generateAccessCode();
  const email = accessEmail(publicId);

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { access_code: true, client_id: t.clientId },
  });
  if (created.error || !created.data.user) {
    throw new HttpError(500, created.error?.message ?? "Falha ao criar o acesso");
  }
  const userId = created.data.user.id;

  const undo = async (message: string): Promise<never> => {
    await admin.auth.admin.deleteUser(userId);
    throw new HttpError(500, message);
  };

  const membership = await admin
    .from("memberships")
    .insert({ user_id: userId, client_id: t.clientId, role });
  if (membership.error) await undo(membership.error.message);

  const expiresAt = days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
  const row = await admin.from("access_codes").insert({
    client_id: t.clientId,
    user_id: userId,
    public_id: publicId,
    label: label || null,
    role,
    created_by: t.userId,
    expires_at: expiresAt,
  });
  if (row.error) await undo(row.error.message);

  return NextResponse.json({ code, expiresAt });
});

// revoga: apagar o usuário encerra o acesso e remove vínculo e registro em cascata
export const DELETE = route(async (req) => {
  const t = await requireStaff();
  const { id } = await req.json();
  if (!id || typeof id !== "string") throw new HttpError(400, "id obrigatório");
  const admin = adminClient();
  const { data, error } = await admin
    .from("access_codes")
    .select("user_id")
    .eq("id", id)
    .eq("client_id", t.clientId)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Acesso não encontrado neste cliente");
  const del = await admin.auth.admin.deleteUser(data.user_id);
  if (del.error) throw new HttpError(500, del.error.message);
  return NextResponse.json({ ok: true });
});
