import { writer, body } from "@/lib/erp/http";
import { payTitle } from "@/lib/erp/services/finance";

export const POST = writer(async ({ tenant }, req, p) => payTitle(tenant, p.id, (await body(req)) as never));
