import { reader, writer, body, param } from "@/lib/erp/http";
import { listMoves, manualMove } from "@/lib/erp/services/stock";

export const GET = reader(async ({ tenant }, req) => ({
  moves: await listMoves(tenant, { productId: param(req, "productId"), limit: Number(param(req, "limit")) || undefined }),
}));
export const POST = writer(async ({ tenant }, req) => manualMove(tenant, (await body(req)) as never), 201);
