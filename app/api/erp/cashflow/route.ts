import { reader, param } from "@/lib/erp/http";
import { cashflow } from "@/lib/erp/services/finance";

export const GET = reader(({ tenant }, req) => cashflow(tenant, Number(param(req, "days")) || 60));
