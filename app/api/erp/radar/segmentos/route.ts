import { reader } from "@/lib/erp/http";
import { customerSegments } from "@/lib/erp/services/radar";
import { radarConfigured } from "@/lib/radar/api";
import { HttpError } from "@/lib/tenant";

export const GET = reader(async ({ tenant }) => {
  if (!radarConfigured()) throw new HttpError(503, "A prospecção ainda não foi ligada neste ambiente.");
  return customerSegments(tenant);
});
