import { z } from "zod";
import { writer, body } from "@/lib/erp/http";
import { settleFromBank } from "@/lib/erp/services/conciliation";

const schema = z.object({
  title_id: z.uuid(),
  paid_at: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Data inválida."),
  amount: z.coerce.number().gt(0),
});

// Confirma uma sugestão da conciliação: baixa a conta a receber com a data e o valor do extrato.
export const POST = writer(async ({ tenant }, req) => settleFromBank(tenant, schema.parse(await body(req))));
