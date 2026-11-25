import { reader, param } from "@/lib/erp/http";
import { stockRelation } from "@/lib/erp/services/stock-relation";

export const GET = reader(({ tenant }, req) => stockRelation(tenant, Number(param(req, "days")) || 30));
