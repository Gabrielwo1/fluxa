import { NextResponse } from "next/server";
import { erpContext, erpRoute } from "@/lib/erp/auth";
import { invoicePdf } from "@/lib/erp/services/invoices";

export const runtime = "nodejs";

export const GET = erpRoute(async (_req, ctx) => {
  const { tenant } = await erpContext();
  const { id } = await ctx.params;
  const { pdf, name } = await invoicePdf(tenant, id);
  return new NextResponse(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}"` } });
});
