import { writer } from "@/lib/erp/http";
import { unpayTitle } from "@/lib/erp/services/finance";

export const POST = writer(({ tenant }, _req, p) => unpayTitle(tenant, p.id));
