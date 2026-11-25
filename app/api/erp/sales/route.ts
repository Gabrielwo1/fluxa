import { reader, writer, body, param } from "@/lib/erp/http";
import { createSale, listSales, salesSummary } from "@/lib/erp/services/sales";

export const GET = reader(async ({ tenant }, req) => {
  const filter = {
    status: param(req, "status"),
    q: param(req, "q"),
    from: param(req, "from"),
    to: param(req, "to"),
    customerId: param(req, "customerId"),
    limit: Number(param(req, "limit")) || undefined,
  };
  // a lista vem paginada por "limit"; os totais do topo são sempre do período inteiro
  const [sales, summary] = await Promise.all([listSales(tenant, filter), salesSummary(tenant, filter)]);
  return { sales, summary };
});
export const POST = writer(async ({ tenant }, req) => createSale(tenant, (await body(req)) as never), 201);
