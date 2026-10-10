import { z } from "zod";

/** Regime do prestador. Define opSimpNac no DPS. */
export const RegimeSchema = z.enum(["MEI", "SIMPLES", "PRESUMIDO", "REAL"]);
export type Regime = z.infer<typeof RegimeSchema>;

/** Dados do prestador (quem emite). Fica no perfil do usuário. */
export const PrestadorSchema = z.object({
  cnpj: z.string().regex(/^\d{14}$/, "CNPJ deve ter 14 dígitos"),
  razaoSocial: z.string().min(1),
  regime: RegimeSchema.default("MEI"),
  /** Código IBGE do município do emitente (7 dígitos). */
  codigoMunicipio: z.string().regex(/^\d{7}$/),
  /** Série do DPS (padrão 1). */
  serie: z.number().int().positive().default(1),
  email: z.string().email().optional(),
  cnaes: z.array(z.object({ codigo: z.string().regex(/^\d{7}$/), descricao: z.string() })).optional(),
  municipioNome: z.string().optional(),
  uf: z.string().length(2).optional(),
});
export type Prestador = z.infer<typeof PrestadorSchema>;

/** Tomador (cliente). CPF ou CNPJ. Endereço é opcional para o MEI mas recomendado. */
export const TomadorSchema = z.object({
  documento: z
    .string()
    .regex(/^\d{11}$|^\d{14}$/, "Informe CPF (11) ou CNPJ (14) só com números"),
  nome: z.string().min(1),
  email: z.string().email().optional(),
  telefone: z.string().optional(),
  endereco: z
    .object({
      logradouro: z.string(),
      numero: z.string(),
      complemento: z.string().optional(),
      bairro: z.string(),
      codigoMunicipio: z.string().regex(/^\d{7}$/),
      cep: z.string().regex(/^\d{8}$/),
    })
    .optional(),
});
export type Tomador = z.infer<typeof TomadorSchema>;

/** Rascunho de nota que a IA monta e o usuário confirma antes de emitir. */
export const RascunhoNotaSchema = z.object({
  tomador: TomadorSchema,
  /** Código de tributação nacional (6 dígitos, ex.: 010101). Deriva da LC 116. */
  codigoTributacaoNacional: z.string().regex(/^\d{6}$/),
  descricaoServico: z.string().min(3).max(2000),
  valorServico: z.number().positive(),
  /** Data de competência (AAAA-MM-DD). Padrão: hoje. */
  dataCompetencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Município onde o serviço foi prestado. Padrão: município do prestador. */
  codigoMunicipioPrestacao: z.string().regex(/^\d{7}$/).optional(),
  issRetido: z.boolean().default(false),
  /** Desconto incondicionado, se houver. */
  valorDesconto: z.number().nonnegative().optional(),
});
export type RascunhoNota = z.infer<typeof RascunhoNotaSchema>;

export type Ambiente = "producao" | "homologacao";

export interface ResultadoEmissao {
  ok: true;
  modo: "sefin" | "portal" | "simulacao";
  chaveAcesso: string;
  numeroNfse?: string;
  dataProcessamento: string;
  xmlNfse?: string;
}

export interface FalhaEmissao {
  ok: false;
  modo: "sefin" | "portal" | "simulacao";
  erros: { codigo: string; descricao: string; complemento?: string }[];
}

export type RespostaEmissao = ResultadoEmissao | FalhaEmissao;
