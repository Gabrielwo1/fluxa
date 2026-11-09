import { z } from "zod";
import { HttpError } from "@/lib/tenant";
import { one, q } from "@/lib/erp/db";
import { companySchema } from "@/lib/erp/schemas";
import type { Company } from "@/lib/erp/types";

export async function getCompany(tenant: string): Promise<Company> {
  const row = await one<Company>(
    tenant,
    `select tenant, name, trade_name, document, email, phone, zip, street, number, district, city, state,
            allow_negative_stock, has_demo
       from erp_company where tenant = $1`
  );
  if (!row) throw new HttpError(404, "Empresa não encontrada.");
  return row;
}

export async function saveCompany(tenant: string, input: z.input<typeof companySchema>): Promise<Company> {
  const v = companySchema.parse(input);
  await q(
    tenant,
    `update erp_company set name=$2, trade_name=$3, document=$4, email=$5, phone=$6, zip=$7, street=$8,
            number=$9, district=$10, city=$11, state=$12, allow_negative_stock=$13, updated_at=now()
      where tenant = $1`,
    [v.name, v.trade_name, v.document, v.email, v.phone, v.zip, v.street, v.number, v.district, v.city, v.state.toUpperCase(), v.allow_negative_stock]
  );
  return getCompany(tenant);
}
