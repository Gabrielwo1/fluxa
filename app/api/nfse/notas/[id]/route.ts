import { NextResponse } from "next/server";
import { HttpError, getTenant } from "@/lib/tenant";
import { marcarCancelada, obterNota } from "@/lib/nfse-store";

function erro(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: String(e) }, { status: 500 });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const t = await getTenant();
    const nota = await obterNota(t, (await ctx.params).id);
    if (!nota) return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 });
    return NextResponse.json(nota);
  } catch (e) {
    return erro(e);
  }
}

/** Marca como cancelada no registro. O cancelamento no governo ainda não é automático. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const t = await getTenant();
    await marcarCancelada(t, (await ctx.params).id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return erro(e);
  }
}
