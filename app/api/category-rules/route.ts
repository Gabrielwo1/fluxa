import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { HttpError, getTenant } from "@/lib/tenant";
import { getRules, setRule } from "@/lib/store";

export const GET = route(async () => {
  const t = await getTenant();
  return NextResponse.json({ rules: await getRules(t) });
});

// { key, category } cria/atualiza; { key, category: null } remove
export const POST = route(async (req) => {
  const t = await getTenant();
  const { key, category } = await req.json();
  if (!key || typeof key !== "string") throw new HttpError(400, "key obrigatório");
  await setRule(t, key.slice(0, 200), category ? String(category).slice(0, 120) : null);
  return NextResponse.json({ rules: await getRules(t) });
});
