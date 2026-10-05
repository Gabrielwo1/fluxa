import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { HttpError, getTenant } from "@/lib/tenant";
import { assertItemAllowed } from "@/lib/pluggy-guard";
import { pluggyFetch } from "@/lib/pluggy";

export const GET = route(async (req) => {
  const t = await getTenant();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) throw new HttpError(400, "id obrigatório");
  await assertItemAllowed(t, id);
  return NextResponse.json(await pluggyFetch(`/items/${encodeURIComponent(id)}`));
});
