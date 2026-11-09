import { writer } from "@/lib/erp/http";
import { cancelPurchase } from "@/lib/erp/services/purchases";

export const POST = writer(({ tenant }, _req, p) => cancelPurchase(tenant, p.id));
