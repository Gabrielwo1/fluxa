import { reader, writer, body } from "@/lib/erp/http";
import { createCategory, listCategories } from "@/lib/erp/services/finance";

export const GET = reader(async ({ tenant }) => ({ categories: await listCategories(tenant) }));
export const POST = writer(async ({ tenant }, req) => createCategory(tenant, (await body(req)) as never), 201);
