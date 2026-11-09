import { writer, body } from "@/lib/erp/http";
import { receivePurchase } from "@/lib/erp/services/purchases";

export const POST = writer(async ({ tenant }, req, p) => receivePurchase(tenant, p.id, (await body(req)) as never));
