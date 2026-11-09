import { reader, writer, body } from "@/lib/erp/http";
import { deletePurchase, getPurchase, updatePurchase } from "@/lib/erp/services/purchases";

export const GET = reader(({ tenant }, _req, p) => getPurchase(tenant, p.id));
export const PUT = writer(async ({ tenant }, req, p) => updatePurchase(tenant, p.id, (await body(req)) as never));
export const DELETE = writer(async ({ tenant }, _req, p) => {
  await deletePurchase(tenant, p.id);
  return { ok: true };
});
