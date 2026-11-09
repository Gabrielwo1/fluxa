import { reader, writer, body } from "@/lib/erp/http";
import { deleteProduct, getProduct, updateProduct } from "@/lib/erp/services/products";

export const GET = reader(({ tenant }, _req, p) => getProduct(tenant, p.id));
export const PUT = writer(async ({ tenant }, req, p) => updateProduct(tenant, p.id, (await body(req)) as never));
export const DELETE = writer(async ({ tenant }, _req, p) => {
  await deleteProduct(tenant, p.id);
  return { ok: true };
});
