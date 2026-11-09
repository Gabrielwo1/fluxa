import { reader, writer, body, param } from "@/lib/erp/http";
import { createParty, listParties } from "@/lib/erp/services/parties";

export const GET = reader(async ({ tenant }, req) => ({
  parties: await listParties(tenant, {
    kind: (param(req, "kind") as "customer" | "supplier" | undefined) || undefined,
    q: param(req, "q"),
    status: param(req, "status"),
    limit: Number(param(req, "limit")) || undefined,
  }),
}));
export const POST = writer(async ({ tenant }, req) => createParty(tenant, (await body(req)) as never), 201);
