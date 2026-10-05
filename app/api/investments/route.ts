import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { HttpError, getTenant } from "@/lib/tenant";
import { assertItemAllowed } from "@/lib/pluggy-guard";
import { pluggyFetch } from "@/lib/pluggy";

export const GET = route(async (req) => {
  const t = await getTenant();
  const itemId = req.nextUrl.searchParams.get("itemId");
  if (!itemId) throw new HttpError(400, "itemId obrigatório");
  await assertItemAllowed(t, itemId);
  return NextResponse.json(
    await pluggyFetch(`/investments?itemId=${encodeURIComponent(itemId)}`)
  );
});
