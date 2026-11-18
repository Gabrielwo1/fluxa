import { reader, param } from "@/lib/erp/http";
import { knownByCnpj } from "@/lib/erp/services/radar";

// Marca, numa lista de empresas do Radar, quais já estão no cadastro do Fluxa.
export const GET = reader(async ({ tenant }, req) => ({
  known: await knownByCnpj(tenant, (param(req, "cnpjs") ?? "").split(",")),
}));
