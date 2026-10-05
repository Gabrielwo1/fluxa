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
  const px = pluggyFor(t);
  const data = await px.get<{ results?: unknown[] }>(
    `/accounts?itemId=${encodeURIComponent(itemId)}`
  );
  // a Pluggy devolve lista vazia (e não 404) para um item que não existe na aplicação:
  // confirma o item para o erro aparecer com a dica das credenciais
  if (!data.results?.length) await px.get(`/items/${encodeURIComponent(itemId)}`);
  return NextResponse.json(data);
});
