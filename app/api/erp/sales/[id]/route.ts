import { reader, writer, body } from "@/lib/erp/http";
import { deleteSale, getSale, updateSale } from "@/lib/erp/services/sales";

export const GET = reader(({ tenant }, _req, p) => getSale(tenant, p.id));
export const PUT = writer(async ({ tenant }, req, p) => updateSale(tenant, p.id, (await body(req)) as never));
export const DELETE = writer(async ({ tenant }, _req, p) => {
  await deleteSale(tenant, p.id);
  return { ok: true };
});
