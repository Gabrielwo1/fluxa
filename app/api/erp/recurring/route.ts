import { reader, writer, body } from "@/lib/erp/http";
import { createRecurring, listRecurring } from "@/lib/erp/services/finance";

export const GET = reader(async ({ tenant }) => ({ recurring: await listRecurring(tenant) }));
export const POST = writer(async ({ tenant }, req) => createRecurring(tenant, (await body(req)) as never), 201);
