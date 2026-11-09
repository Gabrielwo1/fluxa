import { reader, param } from "@/lib/erp/http";
import { searchAll } from "@/lib/erp/services/search";

export const GET = reader(({ tenant }, req) => searchAll(tenant, param(req, "q") ?? ""));
