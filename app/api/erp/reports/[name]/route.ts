import { reader, param } from "@/lib/erp/http";
import { runReport } from "@/lib/erp/services/reports";

export const GET = reader(({ tenant }, req, p) =>
  runReport(tenant, p.name, { from: param(req, "from"), to: param(req, "to"), group: param(req, "group") })
);
