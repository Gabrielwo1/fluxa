import { NextResponse } from "next/server";
import { MVP_COOKIE } from "@/lib/mvp";

// encerra a sessão do modo MVP (a do Supabase é encerrada no navegador)
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(MVP_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
