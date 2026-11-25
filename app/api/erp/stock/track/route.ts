import { z } from "zod";
import { writer, body } from "@/lib/erp/http";
import { startTracking } from "@/lib/erp/services/stock-relation";

const schema = z.object({ product_id: z.uuid(), count: z.coerce.number().min(0, "Informe quanto tem hoje (zero ou mais).") });

// "Controlar estoque": liga o controle do produto e registra a contagem de hoje.
export const POST = writer(async ({ tenant }, req) => startTracking(tenant, schema.parse(await body(req))), 201);
