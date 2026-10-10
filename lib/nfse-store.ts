import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { HttpError, canEdit, type Tenant } from "@/lib/tenant";
import { cifrar, decifrar } from "@/lib/crypto";
import type { Prestador, RascunhoNota, RespostaEmissao } from "@/lib/nfse/tipos";
import type { NotaResumo, StatusNota } from "@/lib/financeiro";
import type { NotaImportada } from "@/lib/nfse/xml";

/**
 * Dados fiscais do cliente: emitente, credenciais de emissão e notas.
 *
 * Mesma regra do lib/store.ts: em modo Supabase as consultas usam a sessão do usuário
 * (RLS) e sempre carregam o client_id; em modo local (só desenvolvimento) tudo vive num
 * arquivo em data/. As credenciais são cifradas antes de sair daqui, nos dois modos.
 */

export interface EmitenteDb extends Prestador {
  id: string;
  clientId: string;
  modoEmissao: "simulacao" | "sefin" | "portal" | "a3";
  ambiente: "homologacao" | "producao";
  temCredenciais: boolean;
  onboardingConcluido: boolean;
  ultimoNsu: number;
  importadoEm: string | null;
}

export interface Credenciais {
  pfxBase64?: string;
  senhaPfx?: string;
  loginPortal?: string;
  senhaPortal?: string;
  /** Número de série do A3: identificador do dispositivo, não segredo. */
  serieA3?: string;
}

export interface NotaDb {
  id: string;
  criadoEm: string;
  numeroDps: number;
  serie: number;
  status: StatusNota;
  origem: "app" | "manual" | "importada";
  modo: string;
  chaveAcesso: string | null;
  valor: number;
  competencia: string;
  tomadorNome: string;
  tomadorDocumento: string;
  descricao: string;
  erros: { codigo: string; descricao: string }[] | null;
  nota: RascunhoNota;
  xmlNfse?: string | null;
}

export interface FiltroNotas {
  busca?: string;
  status?: StatusNota;
  de?: string;
  ate?: string;
  limite?: number;
}

type Linha = Record<string, unknown>;

const COLUNAS_NOTA =
  "id, created_at, numero_dps, serie, status, origem, modo, chave_acesso, valor, competencia, tomador_nome, tomador_documento, descricao, erros, rascunho";

function fail(error: { message: string; code?: string } | null): void {
  if (!error) return;
  if (error.code === "42501") throw new HttpError(403, "Sem permissão");
  if (error.code === "23505") throw new HttpError(409, "Já existe");
  throw new HttpError(500, error.message);
}

function requireEdit(t: Tenant) {
  if (!canEdit(t)) throw new HttpError(403, "Seu acesso é somente leitura");
}

function mapEmitente(r: Linha, temCredenciais: boolean): EmitenteDb {
  return {
    id: r.id as string,
    clientId: r.client_id as string,
    cnpj: r.cnpj as string,
    razaoSocial: r.razao_social as string,
    regime: r.regime as Prestador["regime"],
    codigoMunicipio: r.codigo_municipio as string,
    serie: r.serie as number,
    email: (r.email as string | null) ?? undefined,
    cnaes: (r.cnaes as Prestador["cnaes"]) ?? [],
    municipioNome: (r.municipio_nome as string | null) ?? undefined,
    uf: (r.uf as string | null) ?? undefined,
    modoEmissao: r.modo_emissao as EmitenteDb["modoEmissao"],
    ambiente: r.ambiente as EmitenteDb["ambiente"],
    temCredenciais,
    onboardingConcluido: Boolean(r.onboarding_concluido),
    ultimoNsu: Number(r.ultimo_nsu ?? 0),
    importadoEm: (r.importado_em as string | null) ?? null,
  };
}

function mapNota(r: Linha): NotaDb {
  return {
    id: r.id as string,
    criadoEm: r.created_at as string,
    numeroDps: r.numero_dps as number,
    serie: r.serie as number,
    status: r.status as StatusNota,
    origem: r.origem as NotaDb["origem"],
    modo: r.modo as string,
    chaveAcesso: (r.chave_acesso as string | null) ?? null,
    valor: Number(r.valor),
    competencia: r.competencia as string,
    tomadorNome: r.tomador_nome as string,
    tomadorDocumento: r.tomador_documento as string,
    descricao: r.descricao as string,
    erros: (r.erros as NotaDb["erros"]) ?? null,
    nota: r.rascunho as RascunhoNota,
    xmlNfse: (r.xml_nfse as string | null | undefined) ?? undefined,
  };
}

/* ------------------------------------------------------------ modo local */

const DATA_DIR = process.env.LOCAL_CLIENT
  ? path.join(process.cwd(), "data", "clients", process.env.LOCAL_CLIENT)
  : path.join(process.cwd(), "data");
const ARQUIVO = "nfse.json";

type Arquivo = {
  emitente: EmitenteDb | null;
  credenciais: Record<string, string | null> | null;
  notas: NotaDb[];
  contadores: Record<string, number>;
};
const VAZIO: Arquivo = { emitente: null, credenciais: null, notas: [], contadores: {} };

async function lerArquivo(): Promise<Arquivo> {
  try {
    return { ...VAZIO, ...JSON.parse(await fs.readFile(path.join(DATA_DIR, ARQUIVO), "utf-8")) };
  } catch {
    return { ...VAZIO };
  }
}

async function gravarArquivo(a: Arquivo): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, ARQUIVO), JSON.stringify(a, null, 2));
}

const local = (t: Tenant) => t.mode !== "supabase";

/* -------------------------------------------------------------- emitente */

export async function obterEmitente(t: Tenant): Promise<EmitenteDb | null> {
  if (local(t)) return (await lerArquivo()).emitente;

  const { data, error } = await t
    .db!.from("emitentes")
    .select("*, emitente_credenciais(emitente_id)")
    .eq("client_id", t.clientId)
    .maybeSingle();
  fail(error);
  if (!data) return null;
  const cred = data.emitente_credenciais as unknown;
  return mapEmitente(data, Array.isArray(cred) ? cred.length > 0 : Boolean(cred));
}

/** Cadastro do emitente. Os dados vêm da Receita, conferidos no servidor. */
export async function salvarEmitente(t: Tenant, p: Prestador): Promise<EmitenteDb> {
  requireEdit(t);
  if (local(t)) {
    const a = await lerArquivo();
    a.emitente = {
      ...p,
      id: a.emitente?.id ?? randomUUID(),
      clientId: t.clientId,
      modoEmissao: a.emitente?.modoEmissao ?? "simulacao",
      ambiente: a.emitente?.ambiente ?? "homologacao",
      temCredenciais: Boolean(a.credenciais),
      onboardingConcluido: a.emitente?.onboardingConcluido ?? false,
      ultimoNsu: a.emitente?.ultimoNsu ?? 0,
      importadoEm: a.emitente?.importadoEm ?? null,
    };
    await gravarArquivo(a);
    return a.emitente;
  }

  const { data, error } = await t
    .db!.from("emitentes")
    .upsert(
      {
        client_id: t.clientId,
        cnpj: p.cnpj,
        razao_social: p.razaoSocial,
        regime: p.regime,
        codigo_municipio: p.codigoMunicipio,
        serie: p.serie,
        email: p.email ?? null,
        cnaes: p.cnaes ?? [],
        municipio_nome: p.municipioNome ?? null,
        uf: p.uf ?? null,
      },
      { onConflict: "client_id" }
    )
    .select()
    .single();
  fail(error);
  return mapEmitente(data!, false);
}

/** Completa CNAEs e município de quem se cadastrou antes desses campos existirem. */
export async function completarCadastro(
  t: Tenant,
  emitenteId: string,
  d: { cnaes: NonNullable<Prestador["cnaes"]>; municipioNome: string; uf: string }
): Promise<void> {
  if (local(t)) {
    const a = await lerArquivo();
    if (a.emitente) {
      Object.assign(a.emitente, { cnaes: d.cnaes, municipioNome: d.municipioNome, uf: d.uf });
      await gravarArquivo(a);
    }
    return;
  }
  const { error } = await t
    .db!.from("emitentes")
    .update({ cnaes: d.cnaes, municipio_nome: d.municipioNome, uf: d.uf })
    .eq("id", emitenteId)
    .eq("client_id", t.clientId);
  fail(error);
}

export async function atualizarModoEmissao(
  t: Tenant,
  modo: EmitenteDb["modoEmissao"],
  ambiente: EmitenteDb["ambiente"],
  onboardingConcluido?: boolean
): Promise<void> {
  requireEdit(t);
  const campos: Record<string, unknown> = { modo_emissao: modo, ambiente };
  if (onboardingConcluido !== undefined) campos.onboarding_concluido = onboardingConcluido;

  if (local(t)) {
    const a = await lerArquivo();
    if (!a.emitente) throw new HttpError(404, "Emitente não cadastrado");
    a.emitente.modoEmissao = modo;
    a.emitente.ambiente = ambiente;
    if (onboardingConcluido !== undefined) a.emitente.onboardingConcluido = onboardingConcluido;
    await gravarArquivo(a);
    return;
  }
  const { error } = await t.db!.from("emitentes").update(campos).eq("client_id", t.clientId);
  fail(error);
}

/* ----------------------------------------------------------- credenciais */

export async function salvarCredenciais(t: Tenant, emitenteId: string, c: Credenciais): Promise<void> {
  requireEdit(t);
  const linha = {
    pfx_cifrado: c.pfxBase64 ? cifrar(c.pfxBase64) : null,
    senha_pfx_cifrada: c.senhaPfx ? cifrar(c.senhaPfx) : null,
    login_portal: c.loginPortal ?? null,
    senha_portal_cifrada: c.senhaPortal ? cifrar(c.senhaPortal) : null,
    serie_a3: c.serieA3 ?? null,
  };

  if (local(t)) {
    const a = await lerArquivo();
    a.credenciais = linha;
    if (a.emitente) a.emitente.temCredenciais = true;
    await gravarArquivo(a);
    return;
  }
  const { error } = await t
    .db!.from("emitente_credenciais")
    .upsert({ emitente_id: emitenteId, client_id: t.clientId, ...linha, updated_at: new Date().toISOString() });
  fail(error);
}

export async function obterCredenciais(t: Tenant, emitenteId: string): Promise<Credenciais | null> {
  const linha = local(t)
    ? (await lerArquivo()).credenciais
    : await (async () => {
        const { data, error } = await t
          .db!.from("emitente_credenciais")
          .select("*")
          .eq("emitente_id", emitenteId)
          .maybeSingle();
        fail(error);
        return data as Record<string, string | null> | null;
      })();
  if (!linha) return null;
  return {
    pfxBase64: linha.pfx_cifrado ? decifrar(linha.pfx_cifrado) : undefined,
    senhaPfx: linha.senha_pfx_cifrada ? decifrar(linha.senha_pfx_cifrada) : undefined,
    loginPortal: linha.login_portal ?? undefined,
    senhaPortal: linha.senha_portal_cifrada ? decifrar(linha.senha_portal_cifrada) : undefined,
    serieA3: linha.serie_a3 ?? undefined,
  };
}

/* ----------------------------------------------------------------- notas */

export async function proximoNumeroDps(t: Tenant, emitenteId: string, serie: number): Promise<number> {
  if (local(t)) {
    const a = await lerArquivo();
    const chave = String(serie);
    a.contadores[chave] = (a.contadores[chave] ?? 0) + 1;
    await gravarArquivo(a);
    return a.contadores[chave];
  }
  const { data, error } = await t.db!.rpc("proximo_numero_dps", { p_emitente: emitenteId, p_serie: serie });
  fail(error);
  return data as number;
}

/** Passo 1 da emissão: registra a nota como "processando" antes de falar com o governo. */
export async function criarNotaProcessando(
  t: Tenant,
  emitenteId: string,
  serie: number,
  numeroDps: number,
  modo: string,
  nota: RascunhoNota
): Promise<string> {
  const base = {
    numero_dps: numeroDps,
    serie,
    status: "processando" as const,
    origem: "app" as const,
    modo,
    valor: nota.valorServico,
    competencia: nota.dataCompetencia,
    tomador_nome: nota.tomador.nome,
    tomador_documento: nota.tomador.documento,
    descricao: nota.descricaoServico,
    rascunho: nota,
  };

  if (local(t)) {
    const a = await lerArquivo();
    const id = randomUUID();
    a.notas.unshift(mapNota({ ...base, id, created_at: new Date().toISOString(), chave_acesso: null }));
    await gravarArquivo(a);
    return id;
  }
  const { data, error } = await t
    .db!.from("notas_fiscais")
    .insert({ client_id: t.clientId, emitente_id: emitenteId, ...base })
    .select("id")
    .single();
  fail(error);
  return data!.id as string;
}

/** Passo 2 da emissão: grava o resultado, com sucesso ou com os erros do governo. */
export async function concluirNota(t: Tenant, id: string, resultado: RespostaEmissao): Promise<void> {
  const campos = {
    status: resultado.ok ? (resultado.modo === "simulacao" ? "simulada" : "emitida") : "erro",
    modo: resultado.modo,
    chave_acesso: resultado.ok ? resultado.chaveAcesso : null,
    xml_nfse: resultado.ok ? (resultado.xmlNfse ?? null) : null,
    erros: resultado.ok ? null : resultado.erros,
  };

  if (local(t)) {
    const a = await lerArquivo();
    const nota = a.notas.find((n) => n.id === id);
    if (nota) {
      nota.status = campos.status as StatusNota;
      nota.modo = campos.modo;
      nota.chaveAcesso = campos.chave_acesso;
      nota.xmlNfse = campos.xml_nfse;
      nota.erros = campos.erros as NotaDb["erros"];
      await gravarArquivo(a);
    }
    return;
  }
  const { error } = await t
    .db!.from("notas_fiscais")
    .update(campos)
    .eq("id", id)
    .eq("client_id", t.clientId);
  fail(error);
}

export interface NotaManual {
  valor: number;
  competencia: string;
  tomadorNome: string;
  tomadorDocumento: string;
  descricao: string;
  chaveAcesso?: string;
}

/** Nota emitida fora do app (portal, contador) que entra só no controle financeiro. */
export async function registrarNotaManual(t: Tenant, emitenteId: string, n: NotaManual): Promise<NotaDb> {
  requireEdit(t);
  const numero = await proximoNumeroDps(t, emitenteId, 0);
  const rascunho: RascunhoNota = {
    tomador: { documento: n.tomadorDocumento, nome: n.tomadorNome },
    codigoTributacaoNacional: "000000",
    descricaoServico: n.descricao,
    valorServico: n.valor,
    dataCompetencia: n.competencia,
    issRetido: false,
  };
  const base = {
    numero_dps: numero,
    serie: 0,
    status: "registrada" as const,
    origem: "manual" as const,
    modo: "manual",
    chave_acesso: n.chaveAcesso ?? null,
    valor: n.valor,
    competencia: n.competencia,
    tomador_nome: n.tomadorNome,
    tomador_documento: n.tomadorDocumento,
    descricao: n.descricao,
    rascunho,
  };

  if (local(t)) {
    const a = await lerArquivo();
    const nota = mapNota({ ...base, id: randomUUID(), created_at: new Date().toISOString() });
    a.notas.unshift(nota);
    await gravarArquivo(a);
    return nota;
  }
  const { data, error } = await t
    .db!.from("notas_fiscais")
    .insert({ client_id: t.clientId, emitente_id: emitenteId, ...base })
    .select(COLUNAS_NOTA)
    .single();
  fail(error);
  return mapNota(data!);
}

export async function marcarCancelada(t: Tenant, id: string): Promise<void> {
  requireEdit(t);
  if (local(t)) {
    const a = await lerArquivo();
    const nota = a.notas.find((n) => n.id === id);
    if (nota) nota.status = "cancelada";
    await gravarArquivo(a);
    return;
  }
  const { error } = await t
    .db!.from("notas_fiscais")
    .update({ status: "cancelada" })
    .eq("id", id)
    .eq("client_id", t.clientId);
  fail(error);
}

export async function listarNotas(t: Tenant, f: FiltroNotas = {}): Promise<NotaDb[]> {
  if (local(t)) {
    const busca = f.busca?.toLowerCase().trim();
    return (await lerArquivo()).notas
      .filter((n) => (f.status ? n.status === f.status : true))
      .filter((n) => (f.de ? n.competencia >= f.de : true))
      .filter((n) => (f.ate ? n.competencia <= f.ate : true))
      .filter((n) =>
        busca
          ? [n.tomadorNome, n.descricao, n.tomadorDocumento].some((c) => c.toLowerCase().includes(busca))
          : true
      )
      .slice(0, f.limite ?? 200);
  }

  let q = t.db!.from("notas_fiscais").select(COLUNAS_NOTA).eq("client_id", t.clientId);
  if (f.status) q = q.eq("status", f.status);
  if (f.de) q = q.gte("competencia", f.de);
  if (f.ate) q = q.lte("competencia", f.ate);
  if (f.busca) {
    const b = f.busca.replace(/[%,()]/g, " ").trim();
    q = q.or(
      `tomador_nome.ilike.%${b}%,descricao.ilike.%${b}%,tomador_documento.ilike.%${b.replace(/\D/g, "") || "___"}%`
    );
  }
  const { data, error } = await q
    .order("competencia", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(f.limite ?? 200);
  fail(error);
  return (data ?? []).map(mapNota);
}

export async function obterNota(t: Tenant, id: string): Promise<NotaDb | null> {
  if (local(t)) return (await lerArquivo()).notas.find((n) => n.id === id) ?? null;
  const { data, error } = await t
    .db!.from("notas_fiscais")
    .select("*")
    .eq("id", id)
    .eq("client_id", t.clientId)
    .maybeSingle();
  fail(error);
  return data ? mapNota(data) : null;
}

/** Dados enxutos para o resumo financeiro e o limite do MEI. */
export async function notasParaResumo(t: Tenant, desde: string): Promise<NotaResumo[]> {
  if (local(t)) {
    return (await lerArquivo()).notas
      .filter((n) => n.competencia >= desde)
      .map((n) => ({
        valor: n.valor,
        competencia: n.competencia,
        status: n.status,
        tomadorNome: n.tomadorNome,
      }));
  }
  const { data, error } = await t
    .db!.from("notas_fiscais")
    .select("valor, competencia, status, tomador_nome")
    .eq("client_id", t.clientId)
    .gte("competencia", desde);
  fail(error);
  return (data ?? []).map((r) => ({
    valor: Number(r.valor),
    competencia: r.competencia as string,
    status: r.status as StatusNota,
    tomadorNome: r.tomador_nome as string,
  }));
}

/* ----------------------------------------------- importação do histórico */

export interface ResumoGravacao {
  importadas: number;
  duplicadas: number;
}

/** Grava o que veio do governo ignorando o que já está aqui. Deduplica pela chave de acesso. */
export async function salvarNotasImportadas(
  t: Tenant,
  emitenteId: string,
  modo: string,
  notas: NotaImportada[]
): Promise<ResumoGravacao> {
  requireEdit(t);
  if (notas.length === 0) return { importadas: 0, duplicadas: 0 };

  const linhas = notas.map((n) => ({
    client_id: t.clientId,
    emitente_id: emitenteId,
    numero_dps: n.numeroDps,
    serie: n.serie,
    status: "emitida",
    origem: "importada",
    modo,
    chave_acesso: n.chaveAcesso,
    valor: n.valor,
    competencia: n.competencia,
    tomador_nome: n.tomadorNome,
    tomador_documento: n.tomadorDocumento,
    descricao: n.descricao,
    xml_nfse: n.xml,
    rascunho: {
      tomador: { documento: n.tomadorDocumento, nome: n.tomadorNome },
      codigoTributacaoNacional: n.codigoTributacaoNacional ?? "000000",
      descricaoServico: n.descricao,
      valorServico: n.valor,
      dataCompetencia: n.competencia,
      issRetido: false,
    },
  }));

  if (local(t)) {
    const a = await lerArquivo();
    const existentes = new Set(a.notas.map((n) => n.chaveAcesso).filter(Boolean));
    const novas = linhas.filter((l) => !existentes.has(l.chave_acesso));
    for (const l of novas) {
      a.notas.unshift(mapNota({ ...l, id: randomUUID(), created_at: new Date().toISOString() }));
    }
    await gravarArquivo(a);
    return { importadas: novas.length, duplicadas: notas.length - novas.length };
  }

  const { data, error } = await t
    .db!.from("notas_fiscais")
    .upsert(linhas, { onConflict: "emitente_id,chave_acesso", ignoreDuplicates: true })
    .select("id");
  fail(error);
  const importadas = data?.length ?? 0;
  return { importadas, duplicadas: notas.length - importadas };
}

/** Alinha o contador com o maior número já usado, senão a próxima emissão colide. */
export async function sincronizarContador(t: Tenant, emitenteId: string, serie: number): Promise<number> {
  if (local(t)) {
    const a = await lerArquivo();
    const maior = Math.max(0, ...a.notas.filter((n) => n.serie === serie).map((n) => n.numeroDps));
    a.contadores[String(serie)] = Math.max(a.contadores[String(serie)] ?? 0, maior);
    await gravarArquivo(a);
    return maior;
  }
  const { data, error } = await t.db!.rpc("sincronizar_contador_dps", {
    p_emitente: emitenteId,
    p_serie: serie,
  });
  fail(error);
  return data as number;
}

export async function registrarImportacao(t: Tenant, ultimoNsu?: number): Promise<void> {
  const campos: Record<string, unknown> = { importado_em: new Date().toISOString() };
  if (ultimoNsu !== undefined) campos.ultimo_nsu = ultimoNsu;

  if (local(t)) {
    const a = await lerArquivo();
    if (a.emitente) {
      a.emitente.importadoEm = campos.importado_em as string;
      if (ultimoNsu !== undefined) a.emitente.ultimoNsu = ultimoNsu;
      await gravarArquivo(a);
    }
    return;
  }
  const { error } = await t.db!.from("emitentes").update(campos).eq("client_id", t.clientId);
  fail(error);
}
