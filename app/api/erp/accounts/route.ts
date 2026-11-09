import { reader, writer, body } from "@/lib/erp/http";
import { createAccount, listAccounts } from "@/lib/erp/services/finance";

export const GET = reader(async ({ tenant }) => ({ accounts: await listAccounts(tenant) }));
export const POST = writer(async ({ tenant }, req) => createAccount(tenant, (await body(req)) as never), 201);
