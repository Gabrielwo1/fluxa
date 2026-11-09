import { reader, writer, body, param } from "@/lib/erp/http";
import { createPurchase, listPurchases } from "@/lib/erp/services/purchases";

export const GET = reader(async ({ tenant }, req) => ({
  purchases: await listPurchases(tenant, {
    status: param(req, "status"),
    q: param(req, "q"),
    from: param(req, "from"),
    to: param(req, "to"),
    limit: Number(param(req, "limit")) || undefined,
  }),
}));
export const POST = writer(async ({ tenant }, req) => createPurchase(tenant, (await body(req)) as never), 201);
