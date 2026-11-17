import { reader, writer, body, param } from "@/lib/erp/http";
import { invoiceSummary, listInvoices, registerFromXml, registerManual } from "@/lib/erp/services/invoices";

export const GET = reader(async ({ tenant }, req) => ({
  invoices: await listInvoices(tenant, { q: param(req, "q"), year: Number(param(req, "year")) || undefined }),
  summary: await invoiceSummary(tenant),
}));

// Com { xml } registra pelo arquivo do portal; sem xml, pelos campos digitados.
export const POST = writer(async ({ tenant }, req) => {
  const b = await body(req);
  if (typeof b.xml === "string") return registerFromXml(tenant, b.xml, typeof b.sale_id === "string" ? b.sale_id : null);
  return registerManual(tenant, b as never);
}, 201);
