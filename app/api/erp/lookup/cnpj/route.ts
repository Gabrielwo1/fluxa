import { reader, param } from "@/lib/erp/http";
import { HttpError } from "@/lib/tenant";
import { consultarCnpj } from "@/lib/cnpj";

// Preenche o cadastro de um cliente PJ a partir do CNPJ (dados públicos da Receita).
export const GET = reader(async (_c, req) => {
  try {
    const d = await consultarCnpj(param(req, "cnpj") ?? "");
    return {
      name: d.razaoSocial,
      trade_name: d.nomeFantasia ?? "",
      email: d.email ?? "",
      phone: d.telefone ?? "",
      zip: d.endereco.cep,
      street: d.endereco.logradouro,
      number: d.endereco.numero,
      complement: d.endereco.complemento ?? "",
      district: d.endereco.bairro,
      city: d.endereco.municipio,
      state: d.endereco.uf,
    };
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
});
