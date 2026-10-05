import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { HttpError, canEdit, getTenant } from "@/lib/tenant";
import { addConnection, listConnectionIds, removeConnection } from "@/lib/store";
import { pluggyFor } from "@/lib/pluggy-client";

type PluggyItem = {
  id: string;
  clientUserId?: string | null;
  connector?: { name?: string };
};

export const GET = route(async () => {
  const t = await getTenant();
  return NextResponse.json({ ids: await listConnectionIds(t) });
});

// registra a conexão feita no widget. Quem não é da equipe só registra itens
// criados com o clientUserId do próprio cliente (definido ao gerar o token).
export const POST = route(async (req) => {
  const t = await getTenant();
  if (!canEdit(t)) throw new HttpError(403, "Seu acesso é somente leitura");
  const { id } = await req.json();
  if (!id || typeof id !== "string") throw new HttpError(400, "id obrigatório");

  const item = await pluggyFor(t).get<PluggyItem>(`/items/${encodeURIComponent(id)}`);
  if (!t.isStaff && item.clientUserId !== t.clientId) {
    throw new HttpError(403, "Esta conexão não foi criada para o seu cliente");
  }
  await addConnection(t, id, { connector: item.connector?.name });
  return NextResponse.json({ ids: await listConnectionIds(t) });
});

export const DELETE = route(async (req) => {
  const t = await getTenant();
  const { id } = await req.json();
  if (!id) throw new HttpError(400, "id obrigatório");
  await removeConnection(t, id);
  return NextResponse.json({ ids: await listConnectionIds(t) });
});
