import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api";
import { HttpError, getTenant } from "@/lib/tenant";
import { obterEmitente, salvarCredenciais } from "@/lib/nfse-store";
import { carregarPfx } from "@/lib/nfse/assinatura";
import { verificarAptidao } from "@/lib/nfse/aptidao";

export const runtime = "nodejs";
export const maxDuration = 30;

const BodySchema = z.object({
  pfxBase64: z.string().optional(),
  senhaPfx: z.string().optional(),
  /** Ambiente em que o certificado vai ser usado; define onde testar a conexão. */
  ambiente: z.enum(["homologacao", "producao"]).optional(),
  loginPortal: z.string().optional(),
  senhaPortal: z.string().optional(),
  /** Série do certificado A3: identificador do dispositivo físico. */
  serieA3: z.string().optional(),
});

/**
 * Grava credenciais cifradas. Nunca devolve segredo.
 * O certificado só é salvo depois da verificação de aptidão: vencido, fora da ICP-Brasil
 * ou de outra empresa volta com a lista de problemas e não é gravado.
 */
export const POST = route(async (req) => {
  const t = await getTenant();
  const body = BodySchema.safeParse(await req.json());
  if (!body.success) throw new HttpError(400, "Dados inválidos");
  const { ambiente, ...cred } = body.data;

  const emitente = await obterEmitente(t);
  if (!emitente) throw new HttpError(404, "Cadastre o CNPJ antes de conectar");

  let aptidao;
  if (cred.pfxBase64) {
    if (!cred.senhaPfx) throw new HttpError(400, "Informe a senha do certificado");
    let certificado;
    try {
      certificado = carregarPfx(cred.pfxBase64, cred.senhaPfx);
    } catch {
      throw new HttpError(400, "Não foi possível abrir o certificado. Confira o arquivo e a senha.");
    }
    aptidao = await verificarAptidao(certificado, {
      cnpjPrestador: emitente.cnpj,
      ambiente: ambiente ?? emitente.ambiente,
      testarConexao: true,
    });
    if (!aptidao.apto) {
      return NextResponse.json({ error: "O certificado não está apto a emitir.", aptidao }, { status: 422 });
    }
  }

  await salvarCredenciais(t, emitente.id, cred);
  return NextResponse.json({ ok: true, aptidao });
});
