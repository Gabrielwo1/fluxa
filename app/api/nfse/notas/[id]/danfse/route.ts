import { NextResponse } from "next/server";
import { HttpError, getTenant } from "@/lib/tenant";
import { obterEmitente, obterNota } from "@/lib/nfse-store";
import { gerarDanfse } from "@/lib/nfse/danfse";
import { situacaoMunicipio } from "@/lib/municipios";

export const runtime = "nodejs";

/**
 * PDF da nota (DANFSe v2.0), gerado na hora a partir do XML guardado.
 * Não guardamos o PDF: o XML é o documento fiscal, e gerar sob demanda garante que o leiaute
 * reflete a situação atual da nota, com marca d'água se ela tiver sido cancelada depois.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const t = await getTenant();
    const nota = await obterNota(t, (await ctx.params).id);
    if (!nota) return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 });
    if (!nota.xmlNfse) {
      return NextResponse.json(
        {
          error:
            "Esta nota não tem XML guardado, então não dá para gerar o PDF. Notas registradas manualmente ficam só no controle.",
        },
        { status: 404 }
      );
    }
    if (nota.status === "erro" || nota.status === "processando") {
      return NextResponse.json({ error: "A nota não foi autorizada, então não existe PDF para ela." }, { status: 409 });
    }

    const emitente = await obterEmitente(t);
    const pdf = await gerarDanfse(nota.xmlNfse, {
      situacao: nota.status === "cancelada" ? "cancelada" : "normal",
      simulacao: nota.status === "simulada",
      nomeMunicipio: (codigo) => situacaoMunicipio(codigo)?.nome,
      prestadorNome: emitente?.razaoSocial,
    });

    const nome = `danfse-${nota.serie}-${nota.numeroDps}${nota.status === "simulada" ? "-simulacao" : ""}.pdf`;
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${nome}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: `Não foi possível gerar o PDF: ${(e as Error).message}` }, { status: 422 });
  }
}
