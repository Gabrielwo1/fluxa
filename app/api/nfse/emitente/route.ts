import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api";
import { HttpError, getTenant } from "@/lib/tenant";
import { completarCadastro, atualizarModoEmissao, obterEmitente, salvarEmitente } from "@/lib/nfse-store";
import { consultarCnpj } from "@/lib/cnpj";
import { avisoMunicipio, LISTA_ATUALIZADA_EM, situacaoMunicipio } from "@/lib/municipios";
import type { EmitenteDb } from "@/lib/nfse-store";

/**
 * Emitente fiscal do cliente ativo. Quem é o cliente vem da sessão (getTenant), nunca do
 * navegador, então ninguém cadastra ou lê emitente de outro cliente mudando a requisição.
 */

/** Acrescenta o aviso do município, calculado no servidor porque a tabela é grande. */
function comAviso(e: EmitenteDb) {
  const oficial = situacaoMunicipio(e.codigoMunicipio);
  return {
    ...e,
    municipioNome: oficial?.nome ?? e.municipioNome,
    uf: oficial?.uf ?? e.uf,
    avisoMunicipio: avisoMunicipio(e.codigoMunicipio, e.regime),
    listaMunicipiosEm: LISTA_ATUALIZADA_EM,
  };
}

export const GET = route(async () => {
  const t = await getTenant();
  let emitente = await obterEmitente(t);
  if (!emitente) return NextResponse.json(null);

  // Cadastro antigo sem CNAE ou município ganha os dados na primeira visita. Falha na
  // consulta não impede o uso: só fica sem sugestão de código por enquanto.
  if (!emitente.cnaes?.length || !emitente.municipioNome) {
    try {
      const d = await consultarCnpj(emitente.cnpj);
      await completarCadastro(t, emitente.id, {
        cnaes: d.cnaes,
        municipioNome: d.endereco.municipio,
        uf: d.endereco.uf,
      });
      emitente = { ...emitente, cnaes: d.cnaes, municipioNome: d.endereco.municipio, uf: d.endereco.uf };
    } catch {
      // segue sem os dados
    }
  }
  return NextResponse.json(comAviso(emitente));
});

const CadastroSchema = z.object({
  cnpj: z.string(),
  /** E-mail que vai na nota. O da Receita é a reserva. */
  email: z.email().optional(),
});

/**
 * Cadastra o emitente a partir do CNPJ. Razão social, regime, atividades e município vêm da
 * Receita aqui no servidor: o navegador manda só o número.
 */
export const POST = route(async (req) => {
  const t = await getTenant();
  const body = CadastroSchema.safeParse(await req.json());
  const cnpj = body.success ? body.data.cnpj.replace(/\D/g, "") : "";
  if (cnpj.length !== 14) throw new HttpError(400, "Informe um CNPJ com 14 dígitos");

  let receita;
  try {
    receita = await consultarCnpj(cnpj);
  } catch (e) {
    throw new HttpError(502, `Não foi possível confirmar o CNPJ na Receita agora: ${(e as Error).message}`);
  }

  // O e-mail confirmado no cadastro vence; o da Receita às vezes vem malformado.
  const emailReceita = z.email().safeParse(receita.email?.toLowerCase()).success
    ? receita.email!.toLowerCase()
    : undefined;

  const emitente = await salvarEmitente(t, {
    cnpj: receita.cnpj,
    razaoSocial: receita.razaoSocial,
    regime: receita.opcaoMei ? "MEI" : receita.opcaoSimples ? "SIMPLES" : "PRESUMIDO",
    codigoMunicipio: receita.endereco.codigoMunicipio,
    serie: 1,
    email: (body.success ? body.data.email?.toLowerCase() : undefined) ?? emailReceita,
    cnaes: receita.cnaes,
    municipioNome: receita.endereco.municipio,
    uf: receita.endereco.uf,
  });
  return NextResponse.json(comAviso(emitente));
});

const ModoSchema = z.object({
  modoEmissao: z.enum(["simulacao", "sefin", "portal", "a3"]),
  ambiente: z.enum(["homologacao", "producao"]),
  onboardingConcluido: z.boolean().optional(),
});

export const PATCH = route(async (req) => {
  const t = await getTenant();
  const body = ModoSchema.safeParse(await req.json());
  if (!body.success) throw new HttpError(400, "Dados inválidos");
  await atualizarModoEmissao(t, body.data.modoEmissao, body.data.ambiente, body.data.onboardingConcluido);
  return NextResponse.json({ ok: true });
});
