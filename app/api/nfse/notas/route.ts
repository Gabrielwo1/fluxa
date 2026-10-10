import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api";
import { HttpError, getTenant } from "@/lib/tenant";
import { listarNotas, obterEmitente, registrarNotaManual } from "@/lib/nfse-store";
import type { StatusNota } from "@/lib/financeiro";

export const GET = route(async (req) => {
  const t = await getTenant();
  const p = new URL(req.url).searchParams;
  return NextResponse.json(
    await listarNotas(t, {
      busca: p.get("busca") ?? undefined,
      status: (p.get("status") as StatusNota | null) ?? undefined,
      de: p.get("de") ?? undefined,
      ate: p.get("ate") ?? undefined,
      limite: Number(p.get("limite") ?? 200),
    })
  );
});

const ManualSchema = z.object({
  valor: z.number().positive(),
  competencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tomadorNome: z.string().min(1),
  tomadorDocumento: z.string().regex(/^\d{11}$|^\d{14}$/),
  descricao: z.string().min(1),
  chaveAcesso: z.string().optional(),
});

/** Registra uma nota emitida fora do app, só para o controle financeiro. */
export const POST = route(async (req) => {
  const t = await getTenant();
  const body = ManualSchema.safeParse(await req.json());
  if (!body.success) throw new HttpError(400, "Dados inválidos");
  const emitente = await obterEmitente(t);
  if (!emitente) throw new HttpError(404, "Cadastre o CNPJ antes de registrar notas");
  return NextResponse.json(await registrarNotaManual(t, emitente.id, body.data));
});
