import { reader, writer, body, param } from "@/lib/erp/http";
import { createTitles, listTitles, titleSummary } from "@/lib/erp/services/finance";

export const GET = reader(async ({ tenant }, req) => {
  const direction = param(req, "direction") as "in" | "out" | undefined;
  const titles = await listTitles(tenant, {
    direction,
    status: (param(req, "status") as "open" | "overdue" | "paid" | "all" | undefined) ?? "all",
    from: param(req, "from"),
    to: param(req, "to"),
    q: param(req, "q"),
    partyId: param(req, "partyId"),
    categoryId: param(req, "categoryId"),
    limit: Number(param(req, "limit")) || undefined,
  });
  return { titles, summary: direction ? await titleSummary(tenant, direction) : null };
});
export const POST = writer(async ({ tenant }, req) => ({ titles: await createTitles(tenant, (await body(req)) as never) }), 201);
