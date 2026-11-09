import { writer, body } from "@/lib/erp/http";
import { generateRecurring } from "@/lib/erp/services/finance";

export const POST = writer(async ({ tenant }, req) => {
  const { month } = (await body(req)) as { month?: string };
  return generateRecurring(tenant, month);
});
