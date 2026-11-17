import { writer, body } from "@/lib/erp/http";
import { deleteInvoice, updateInvoice } from "@/lib/erp/services/invoices";

export const PUT = writer(async ({ tenant }, req, p) => updateInvoice(tenant, p.id, (await body(req)) as never));
export const DELETE = writer(async ({ tenant }, _req, p) => {
  await deleteInvoice(tenant, p.id);
  return { ok: true };
});
