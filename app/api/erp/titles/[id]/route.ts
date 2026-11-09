import { writer, body } from "@/lib/erp/http";
import { cancelTitle, updateTitle } from "@/lib/erp/services/finance";

export const PUT = writer(async ({ tenant }, req, p) => updateTitle(tenant, p.id, (await body(req)) as never));
export const DELETE = writer(async ({ tenant }, _req, p) => {
  await cancelTitle(tenant, p.id);
  return { ok: true };
});
