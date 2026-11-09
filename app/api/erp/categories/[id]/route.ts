import { writer, body } from "@/lib/erp/http";
import { deleteCategory, updateCategory } from "@/lib/erp/services/finance";

export const PUT = writer(async ({ tenant }, req, p) => updateCategory(tenant, p.id, (await body(req)) as never));
export const DELETE = writer(async ({ tenant }, _req, p) => {
  await deleteCategory(tenant, p.id);
  return { ok: true };
});
