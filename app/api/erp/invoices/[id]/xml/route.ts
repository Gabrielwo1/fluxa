import { NextResponse } from "next/server";
import { erpContext, erpRoute } from "@/lib/erp/auth";
import { invoiceXml } from "@/lib/erp/services/invoices";

export const GET = erpRoute(async (_req, ctx) => {
  const { tenant } = await erpContext();
  const { id } = await ctx.params;
  const { xml, name } = await invoiceXml(tenant, id);
  return new NextResponse(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` } });
});
