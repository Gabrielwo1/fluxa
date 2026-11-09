import { reader } from "@/lib/erp/http";
import { getDashboard } from "@/lib/erp/services/dashboard";

export const GET = reader(({ tenant }) => getDashboard(tenant));
