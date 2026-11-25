import { reader, param } from "@/lib/erp/http";
import { conciliation } from "@/lib/erp/services/conciliation";
import { todayIso, addDaysIso } from "@/lib/erp/format";

export const GET = reader(async ({ tenant }, req) => {
  const to = param(req, "to") ?? todayIso();
  return conciliation(tenant, param(req, "from") ?? addDaysIso(to, -29), to);
});
