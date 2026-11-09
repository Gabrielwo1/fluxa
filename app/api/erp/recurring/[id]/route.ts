import { writer, body } from "@/lib/erp/http";
import { deleteRecurring, updateRecurring } from "@/lib/erp/services/finance";

export const PUT = writer(async ({ tenant }, req, p) => updateRecurring(tenant, p.id, (await body(req)) as never));
export const DELETE = writer(async ({ tenant }, _req, p) => {
  await deleteRecurring(tenant, p.id);
  return { ok: true };
});
