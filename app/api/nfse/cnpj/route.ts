import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { HttpError, getTenant } from "@/lib/tenant";
import { consultarCnpj } from "@/lib/cnpj";

/** Consulta pública da Receita, atrás do login para o app não virar proxy aberto. */
export const GET = route(async (req) => {
  await getTenant();
  const cnpj = new URL(req.url).searchParams.get("cnpj") ?? "";
  try {
    return NextResponse.json(await consultarCnpj(cnpj));
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
});
