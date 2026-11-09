import { reader, writer, body } from "@/lib/erp/http";
import { getCompany, saveCompany } from "@/lib/erp/services/company";

export const GET = reader(({ tenant }) => getCompany(tenant));
export const PUT = writer(async ({ tenant }, req) => saveCompany(tenant, (await body(req)) as never));
