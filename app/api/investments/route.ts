import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { HttpError, getTenant } from "@/lib/tenant";
import { assertItemAllowed } from "@/lib/pluggy-guard";
import { pluggyFor } from "@/lib/pluggy-client";

export const GET = route(async (req) => {
  const t = await getTenant();
  const itemId = req.nextUrl.searchParams.get("itemId");
  if (!itemId) throw new HttpError(400, "itemId obrigatório");
  await assertItemAllowed(t, itemId);
  return NextResponse.json(
    await pluggyFor(t).get(`/investments?itemId=${encodeURIComponent(itemId)}`)
  );
});
