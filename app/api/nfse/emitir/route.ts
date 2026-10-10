import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { HttpError, canEdit, getTenant } from "@/lib/tenant";
import { RascunhoNotaSchema } from "@/lib/nfse/tipos";
import { criarEmissor } from "@/lib/nfse/emissor";
import {
  concluirNota,
  criarNotaProcessando,
  obterCredenciais,
  obterEmitente,
  proximoNumeroDps,
} from "@/lib/nfse-store";
import { avisoMunicipio } from "@/lib/municipios";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Emissão confirmada pela pessoa. É o único lugar que fala com o governo.
 * A nota entra como "processando" antes do envio e é concluída com o resultado, então o
 * financeiro sempre mostra o que está em andamento.
 */
export const POST = route(async (req) => {
  const t = await getTenant();
  if (!canEdit(t)) throw new HttpError(403, "Seu acesso é somente leitura");

  const body = RascunhoNotaSchema.safeParse((await req.json())?.nota);
  if (!body.success) throw new HttpError(400, "Rascunho inválido");
  const nota = body.data;

  const emitente = await obterEmitente(t);
  if (!emitente) throw new HttpError(404, "Cadastre o CNPJ antes de emitir");

  // Fora do MEI, a emissão nacional depende de a cidade ter aderido. Barramos antes de
  // reservar número de DPS e antes de falar com o governo.
  const aviso = avisoMunicipio(emitente.codigoMunicipio, emitente.regime);
  if (aviso.tipo === "sistema-proprio" && emitente.modoEmissao !== "simulacao") {
    throw new HttpError(
      422,
      `${aviso.municipio} não usa o emissor nacional. A nota dessa cidade é emitida no sistema da prefeitura.`
    );
  }

  let emissor;
  try {
    const cred = emitente.modoEmissao === "simulacao" ? null : await obterCredenciais(t, emitente.id);
    emissor = criarEmissor({ modo: emitente.modoEmissao, ambiente: emitente.ambiente, ...cred });
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }

  const numeroDps = await proximoNumeroDps(t, emitente.id, emitente.serie);
  const id = await criarNotaProcessando(t, emitente.id, emitente.serie, numeroDps, emissor.modo, nota);

  let resultado;
  try {
    resultado = await emissor.emitir({ prestador: emitente, nota, numeroDps });
  } catch (e) {
    resultado = {
      ok: false as const,
      modo: emissor.modo,
      erros: [{ codigo: "FALHA", descricao: (e as Error).message }],
    };
  }
  await concluirNota(t, id, resultado);

  if (!resultado.ok) {
    return NextResponse.json({ ok: false, id, modo: resultado.modo, erros: resultado.erros }, { status: 422 });
  }
  return NextResponse.json({ ...resultado, id, numeroDps });
});
