import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { HttpError, getTenant } from "@/lib/tenant";
import { addConnection } from "@/lib/store";
import { pluggyPost } from "@/lib/pluggy";

// banco fictício da Pluggy para testes: só a equipe, e já registra no cliente atual
export const POST = route(async () => {
  const t = await getTenant();
  if (!t.isStaff) throw new HttpError(403, "Apenas a equipe pode usar o modo teste");
  const item = await pluggyPost<{ id: string; status: string }>("/items", {
    connectorId: 2,
    parameters: { user: "user-ok", password: "password-ok" },
    clientUserId: t.clientId,
  });
  await addConnection(t, item.id, { connector: "Pluggy Bank (teste)", label: "Modo teste" });
  return NextResponse.json({ id: item.id, status: item.status });
});
