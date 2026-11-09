import { reader, writer, body, param } from "@/lib/erp/http";
import { createSale, listSales } from "@/lib/erp/services/sales";

export const GET = reader(async ({ tenant }, req) => ({
  sales: await listSales(tenant, {
    status: param(req, "status"),
    q: param(req, "q"),
    from: param(req, "from"),
    to: param(req, "to"),
    customerId: param(req, "customerId"),
    limit: Number(param(req, "limit")) || undefined,
  }),
}));
export const POST = writer(async ({ tenant }, req) => createSale(tenant, (await body(req)) as never), 201);
