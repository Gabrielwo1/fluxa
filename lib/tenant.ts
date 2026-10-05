import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";

export type Role = "owner" | "editor" | "viewer";

export type ClientInfo = { id: string; name: string; slug: string };

// Quem está fazendo a requisição e de qual cliente são os dados que ela enxerga.
export type Tenant = {
  mode: "supabase" | "local";
  userId: string | null;
  email: string | null;
  isStaff: boolean;
  role: Role;
  clientId: string;
  clientName: string;
  clients: ClientInfo[];
  db: SupabaseClient | null;
};

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export const ACTIVE_CLIENT_COOKIE = "active_client";

export async function getTenant(): Promise<Tenant> {
  if (!supabaseConfigured) {
    if (process.env.VERCEL) {
      throw new HttpError(503, "Supabase não configurado neste ambiente");
    }
    return {
      mode: "local",
      userId: null,
      email: null,
      isStaff: true,
      role: "owner",
      clientId: "local",
      clientName: "Modo local",
      clients: [],
      db: null,
    };
  }

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new HttpError(401, "Não autenticado");

  const [{ data: staffRow }, { data: clients }] = await Promise.all([
    db.from("staff").select("user_id").eq("user_id", user.id).maybeSingle(),
    db.from("clients").select("id, name, slug").order("name"),
  ]);
  const isStaff = Boolean(staffRow);
  const list = (clients ?? []) as ClientInfo[];
  if (list.length === 0) {
    throw new HttpError(403, "Este usuário ainda não tem cliente vinculado");
  }

  const wanted = (await cookies()).get(ACTIVE_CLIENT_COOKIE)?.value;
  const current = list.find((c) => c.id === wanted) ?? list[0];

  let role: Role = "owner";
  if (!isStaff) {
    const { data: m } = await db
      .from("memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("client_id", current.id)
      .maybeSingle();
    role = (m?.role as Role) ?? "viewer";
  }

  return {
    mode: "supabase",
    userId: user.id,
    email: user.email ?? null,
    isStaff,
    role,
    clientId: current.id,
    clientName: current.name,
    clients: list,
    db,
  };
}

export const canEdit = (t: Tenant) => t.isStaff || t.role !== "viewer";
