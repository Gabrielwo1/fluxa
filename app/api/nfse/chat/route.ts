import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { route } from "@/lib/api";
import { HttpError, getTenant } from "@/lib/tenant";
import { obterEmitente } from "@/lib/nfse-store";
import { executarAgente } from "@/lib/ai/agente";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({ messages: z.array(z.unknown()).min(1) });

/**
 * Conversa com o assistente que monta o rascunho da nota.
 * O emitente vem do banco, não do navegador: o que o cliente manda é só a conversa.
 */
export const POST = route(async (req) => {
  const t = await getTenant();
  const body = BodySchema.safeParse(await req.json());
  if (!body.success) throw new HttpError(400, "Requisição inválida");

  const emitente = await obterEmitente(t);
  if (!emitente) throw new HttpError(404, "Cadastre o CNPJ antes de usar o assistente");
  if (!process.env.OPENAI_API_KEY) {
    throw new HttpError(503, "O assistente ainda não foi configurado: falta a OPENAI_API_KEY.");
  }

  try {
    const r = await executarAgente(body.data.messages, emitente);
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof OpenAI.AuthenticationError) throw new HttpError(500, "A chave da OpenAI foi recusada.");
    if (e instanceof OpenAI.RateLimitError) throw new HttpError(429, "A OpenAI está limitando as chamadas. Tente em instantes.");
    if (e instanceof OpenAI.APIError) throw new HttpError(502, `A OpenAI respondeu com erro: ${e.message}`);
    throw e;
  }
});
