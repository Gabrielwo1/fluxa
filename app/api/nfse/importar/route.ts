import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api";
import { HttpError, canEdit, getTenant } from "@/lib/tenant";
import {
  obterCredenciais,
  obterEmitente,
  registrarImportacao,
  salvarNotasImportadas,
  sincronizarContador,
} from "@/lib/nfse-store";
import { criarImportador, ImportacaoIndisponivelError } from "@/lib/nfse/importador";

export const runtime = "nodejs";
export const maxDuration = 300;

const BodySchema = z.object({
  /** Conteúdo dos XML enviados pela pessoa. Quando presente, força o modo arquivo. */
  arquivos: z.array(z.string()).max(500).optional(),
});

/**
 * Importa o histórico de notas do cliente. A fonte vem do modo de conexão: ADN por
 * certificado, portal por login, ou os XML enviados.
 */
export const POST = route(async (req) => {
  const t = await getTenant();
  if (!canEdit(t)) throw new HttpError(403, "Seu acesso é somente leitura");

  const body = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) throw new HttpError(400, "Requisição inválida");

  const emitente = await obterEmitente(t);
  if (!emitente) throw new HttpError(404, "Cadastre o CNPJ antes de importar");

  const usarArquivos = Boolean(body.data.arquivos?.length);

  let importador;
  try {
    const cred =
      usarArquivos || emitente.modoEmissao === "simulacao" ? null : await obterCredenciais(t, emitente.id);
    importador = criarImportador({
      modoEmissao: emitente.modoEmissao,
      ambiente: emitente.ambiente,
      arquivos: usarArquivos,
      ...cred,
    });
  } catch (e) {
    if (e instanceof ImportacaoIndisponivelError) throw new HttpError(400, e.message);
    throw new HttpError(400, (e as Error).message);
  }

  let busca;
  try {
    busca = await importador.buscar({
      cnpj: emitente.cnpj,
      ultimoNsu: emitente.ultimoNsu,
      arquivos: body.data.arquivos,
    });
  } catch (e) {
    throw new HttpError(502, `Falha ao buscar o histórico: ${(e as Error).message}`);
  }

  const gravacao = await salvarNotasImportadas(t, emitente.id, importador.modo, busca.notas);
  // Sem isso a próxima emissão pelo app repetiria um número de DPS que já existe.
  if (gravacao.importadas > 0) await sincronizarContador(t, emitente.id, emitente.serie);
  await registrarImportacao(t, busca.ultimoNsu);

  return NextResponse.json({
    ok: true,
    modo: importador.modo,
    encontradas: busca.notas.length,
    importadas: gravacao.importadas,
    duplicadas: gravacao.duplicadas,
    recebidas: busca.recebidas,
    ilegiveis: busca.ilegiveis,
    aviso: busca.aviso,
  });
});
