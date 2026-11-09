import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { getTenant } from "@/lib/tenant";
import { canWriteErp } from "@/lib/erp/auth";
import { erpConfigured } from "@/lib/erp/db";

// A tela usa isto para avisar quando o banco do ERP ainda não foi ligado neste ambiente.
export const GET = route(async () => {
  const t = await getTenant();
  return NextResponse.json({ configured: erpConfigured(), canWrite: canWriteErp(t), company: t.clientName });
});
