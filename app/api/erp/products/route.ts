import { reader, writer, body, param } from "@/lib/erp/http";
import { createProduct, listProducts } from "@/lib/erp/services/products";

export const GET = reader(async ({ tenant }, req) => ({
  products: await listProducts(tenant, {
    q: param(req, "q"),
    kind: param(req, "kind"),
    active: param(req, "active"),
    low: param(req, "low") === "1",
    limit: Number(param(req, "limit")) || undefined,
  }),
}));
export const POST = writer(async ({ tenant }, req) => createProduct(tenant, (await body(req)) as never), 201);
