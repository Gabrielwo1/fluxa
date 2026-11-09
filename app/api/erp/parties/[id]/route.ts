import { reader, writer, body } from "@/lib/erp/http";
import { deleteParty, getParty, updateParty } from "@/lib/erp/services/parties";

export const GET = reader(({ tenant }, _req, p) => getParty(tenant, p.id));
export const PUT = writer(async ({ tenant }, req, p) => updateParty(tenant, p.id, (await body(req)) as never));
export const DELETE = writer(async ({ tenant }, _req, p) => {
  await deleteParty(tenant, p.id);
  return { ok: true };
});
