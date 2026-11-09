import { writer, body } from "@/lib/erp/http";
import { confirmSale } from "@/lib/erp/services/sales";

export const POST = writer(async ({ tenant }, req, p) => confirmSale(tenant, p.id, (await body(req)) as never));
