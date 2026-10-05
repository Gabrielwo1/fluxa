import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { ACTIVE_CLIENT_COOKIE, HttpError, getTenant } from "@/lib/tenant";

// quem tem mais de um cliente (a equipe) escolhe qual painel está vendo
export const POST = route(async (req) => {
  const t = await getTenant();
  const { clientId } = await req.json();
  if (!t.clients.some((c) => c.id === clientId)) {
    throw new HttpError(403, "Cliente inválido");
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACTIVE_CLIENT_COOKIE, clientId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
});
