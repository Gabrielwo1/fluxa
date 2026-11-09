import { writer } from "@/lib/erp/http";
import { cancelSale } from "@/lib/erp/services/sales";

export const POST = writer(({ tenant }, _req, p) => cancelSale(tenant, p.id));
