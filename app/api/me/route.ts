import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { getTenant } from "@/lib/tenant";
import { isDemoSlug } from "@/lib/demo";

export const GET = route(async () => {
  const t = await getTenant();
  return NextResponse.json({
    mode: t.mode,
    demo: isDemoSlug(t.clientSlug),
    email: t.email,
    isStaff: t.isStaff,
    role: t.role,
    client: { id: t.clientId, name: t.clientName },
    clients: t.clients,
  });
});
