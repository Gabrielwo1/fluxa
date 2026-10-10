import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { getTenant } from "@/lib/tenant";
import { notasParaResumo, obterEmitente } from "@/lib/nfse-store";
import { calcularResumo, ultimosMeses } from "@/lib/financeiro";

/** Resumo das notas: últimos 12 meses, ano corrente, limite do MEI e principais clientes. */
export const GET = route(async () => {
  const t = await getTenant();
  const emitente = await obterEmitente(t);
  if (!emitente) return NextResponse.json(null);

  const meses = ultimosMeses(12);
  const inicioAno = meses[meses.length - 1].slice(0, 4) + "-01-01";
  const desde = meses[0] + "-01" < inicioAno ? meses[0] + "-01" : inicioAno;
  return NextResponse.json(calcularResumo(await notasParaResumo(t, desde), emitente.regime));
});
