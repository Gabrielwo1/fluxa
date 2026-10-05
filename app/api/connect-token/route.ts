import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { HttpError, canEdit, getTenant } from "@/lib/tenant";
import { pluggyFor } from "@/lib/pluggy-client";

// o clientUserId amarra o item que será criado ao cliente atual
export const POST = route(async () => {
  const t = await getTenant();
  if (!canEdit(t)) throw new HttpError(403, "Seu acesso é somente leitura");
  const data = await pluggyFor(t).post<{ accessToken: string }>("/connect_token", {
    options: { clientUserId: t.clientId },
  });
  return NextResponse.json(data);
});
