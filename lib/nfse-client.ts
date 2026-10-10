import type { EmitenteDb, NotaDb } from "@/lib/nfse-store";
import type { Aptidao } from "@/lib/nfse/aptidao";
import type { AvisoMunicipio } from "@/lib/municipios";
import type { Resumo } from "@/lib/financeiro";

/**
 * Chamadas do navegador para a parte fiscal. Ficam num lugar só porque as três telas
 * (configuração, emitir e notas) usam as mesmas rotas.
 */

export type Emitente = EmitenteDb & {
  avisoMunicipio?: AvisoMunicipio;
  listaMunicipiosEm?: string | null;
};

export type ModoAcesso = EmitenteDb["modoEmissao"];

export interface DadosConexao {
  modo: ModoAcesso;
  ambiente: EmitenteDb["ambiente"];
  pfxBase64?: string;
  senhaPfx?: string;
  loginPortal?: string;
  senhaPortal?: string;
  serieA3?: string;
}

export interface ResultadoImportacao {
  modo: string;
  importadas: number;
  duplicadas: number;
  recebidas: number;
  ilegiveis: number;
  aviso?: string;
}

/** O certificado abriu, mas não serve para emitir. Carrega a lista de problemas para a tela. */
export class CertificadoInaptoError extends Error {
  constructor(public aptidao: Aptidao) {
    super("O certificado não está apto a emitir.");
  }
}

async function json<T>(r: Response): Promise<T> {
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(corpo.error ?? "Não foi possível completar a operação");
  return corpo as T;
}

const post = (url: string, body?: unknown) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

export async function carregarEmitente(): Promise<Emitente | null> {
  const r = await fetch("/api/nfse/emitente");
  return r.ok ? r.json() : null;
}

export async function consultarCnpjPublico(cnpj: string) {
  return json<{
    cnpj: string;
    razaoSocial: string;
    opcaoMei: boolean;
    opcaoSimples: boolean;
    email?: string;
    cnaes: { codigo: string; descricao: string }[];
    endereco: { municipio: string; uf: string };
  }>(await fetch(`/api/nfse/cnpj?cnpj=${cnpj.replace(/\D/g, "")}`));
}

export async function cadastrarEmitente(cnpj: string, email?: string): Promise<Emitente> {
  return json<Emitente>(await post("/api/nfse/emitente", { cnpj, email }));
}

/** Grava as credenciais cifradas e o modo escolhido. Marca a etapa como vencida. */
export async function salvarConexao(d: DadosConexao): Promise<{ aptidao?: Aptidao }> {
  const credencial =
    d.modo === "sefin" && (d.pfxBase64 || d.senhaPfx)
      ? { pfxBase64: d.pfxBase64, senhaPfx: d.senhaPfx }
      : d.modo === "portal" && (d.loginPortal || d.senhaPortal)
        ? { loginPortal: d.loginPortal, senhaPortal: d.senhaPortal }
        : d.modo === "a3" && d.serieA3
          ? { serieA3: d.serieA3 }
          : null;

  let aptidao: Aptidao | undefined;
  if (credencial) {
    const r = await post("/api/nfse/credenciais", { ambiente: d.ambiente, ...credencial });
    if (r.status === 422) {
      const corpo = await r.json();
      if (corpo.aptidao) throw new CertificadoInaptoError(corpo.aptidao);
    }
    aptidao = (await json<{ aptidao?: Aptidao }>(r)).aptidao;
  }

  await json(
    await fetch("/api/nfse/emitente", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modoEmissao: d.modo, ambiente: d.ambiente, onboardingConcluido: true }),
    })
  );
  return { aptidao };
}

export async function importarHistorico(arquivos?: string[]): Promise<ResultadoImportacao> {
  return json<ResultadoImportacao>(await post("/api/nfse/importar", { arquivos }));
}

export async function listarNotas(busca?: string): Promise<NotaDb[]> {
  const r = await fetch(`/api/nfse/notas${busca ? `?busca=${encodeURIComponent(busca)}` : ""}`);
  return r.ok ? r.json() : [];
}

export async function registrarNotaManual(n: {
  valor: number;
  competencia: string;
  tomadorNome: string;
  tomadorDocumento: string;
  descricao: string;
}): Promise<NotaDb> {
  return json<NotaDb>(await post("/api/nfse/notas", n));
}

export async function cancelarNota(id: string): Promise<void> {
  await json(await fetch(`/api/nfse/notas/${id}`, { method: "DELETE" }));
}

export async function carregarResumo(): Promise<Resumo | null> {
  const r = await fetch("/api/nfse/resumo");
  return r.ok ? r.json() : null;
}

export const fmtDoc = (d: string) =>
  d.length === 14
    ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
    : d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

export const mascararCnpj = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
