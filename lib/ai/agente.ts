import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { z } from "zod";
import { consultarCnpj } from "@/lib/cnpj";
import { buscarServicos, servicoPorCodigo } from "@/lib/servicos";
import { codigoCompativel, formatarCnae, servicosCompativeis } from "@/lib/cnae";
import { RascunhoNotaSchema, type Prestador, type RascunhoNota } from "@/lib/nfse/tipos";

/**
 * Assistente de emissão sobre a API da OpenAI (Chat Completions com ferramentas).
 *
 * O ciclo é manual e curto: o modelo pede ferramentas, o servidor executa, devolve o resultado e
 * repete até o modelo responder em texto. A IA nunca emite: preparar_nota só registra o rascunho,
 * e quem emite é a rota /api/emitir depois da confirmação do usuário.
 */

// Cliente criado sob demanda: sem OPENAI_API_KEY o app sobe, e só o chat avisa que falta a chave.
let cliente: OpenAI | null = null;
function openai() {
  cliente ??= new OpenAI();
  return cliente;
}

const MODELO = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";
/**
 * Esforço de raciocínio só vai quando configurado. Em vários modelos a API de Chat Completions
 * recusa ferramentas junto com esse parâmetro (erro 400), e sem ele o gpt-5.4-mini usa ferramentas
 * normalmente.
 */
const ESFORCO = process.env.OPENAI_REASONING_EFFORT as "none" | "minimal" | "low" | "medium" | "high" | undefined;
const MAX_RODADAS = 8;

/** Parte estável do prompt. Nada volátil aqui, para o prefixo se repetir entre chamadas. */
const SYSTEM_ESTAVEL = `Você é o assistente de emissão de NFS-e (Nota Fiscal de Serviço eletrônica) do padrão nacional, feito para o MEI (microempreendedor individual) prestador de serviço no Brasil.

Seu trabalho: transformar o que o usuário fala em linguagem natural (texto ou voz transcrita) em um rascunho de nota completo e correto, e então pedir confirmação. Você NUNCA emite a nota: quem emite é o botão de confirmação na tela, depois que o usuário aprova o rascunho.

Fluxo:
1. Extraia da mensagem: quem é o cliente (tomador), o valor, o que foi feito (descrição do serviço) e, se houver, a data de competência.
2. Se o cliente for identificado por CNPJ, chame consultar_cnpj para obter razão social e endereço. Se for pessoa física, você precisa do CPF e do nome; peça o que faltar.
3. Use buscar_servico para escolher o código de tributação nacional que melhor descreve o serviço. Dê preferência aos "códigos compatíveis com as atividades da empresa" listados nos dados do prestador: eles vêm do CNAE registrado. Se o serviço descrito não se encaixar em nenhum deles, escolha o código correto mesmo assim, mas avise o usuário em uma frase que esse serviço não aparece entre as atividades do CNPJ e que o MEI só pode emitir para as atividades registradas. Se houver dúvida razoável entre dois códigos, pergunte de forma simples, sem jargão.
4. Quando tiver tomador, valor, descrição e código, chame preparar_nota. Se a ferramenta devolver erro de validação, corrija e chame de novo.
5. Depois de preparar_nota dar certo, responda com um resumo curto do rascunho (cliente, valor, serviço, competência) e peça para o usuário confirmar no botão "Emitir nota".

Regras:
- Qualquer CPF ou CNPJ que o usuário indicar para a nota é o cliente (tomador). Não questione quem é o cliente, o porte, o tipo ou a relação dele com o prestador. Banco, órgão público, grande empresa ou pessoa física: todos podem ser tomadores.
- O único motivo para não chamar preparar_nota é faltar dado obrigatório. Serviço fora das atividades do CNPJ é um aviso para o usuário, nunca motivo para recusar: prepare o rascunho e avise.
- Escreva em português do Brasil, direto e curto. Uma pergunta por vez quando faltar dado.
- Valores em reais. "mil e quinhentos" é 1500.00. "500 conto" é 500.00.
- Data de competência padrão é hoje; se o usuário disser "serviço de agosto", use o último dia útil informado ou o dia 1 do mês, e diga o que assumiu.
- A descrição do serviço vai impressa na nota: escreva de forma profissional e objetiva a partir do que o usuário disse (ex.: "Desenvolvimento de landing page institucional" em vez de "fiz um site").
- Nunca invente CPF, CNPJ ou endereço. Se não tiver, pergunte.
- ISS retido só quando o usuário disser explicitamente que o cliente vai reter o ISS.
- Se o usuário pedir algo fora de emitir nota (dúvidas sobre MEI, DAS, limites), responda brevemente e volte ao fluxo.`;

function systemPerfil(prestador: Prestador, hoje: string): string {
  const cnaes = prestador.cnaes ?? [];
  const sugeridos = servicosCompativeis(cnaes);
  const atividades = cnaes.length
    ? cnaes.map((c, i) => `- ${formatarCnae(c.codigo)} ${c.descricao}${i === 0 ? " (principal)" : ""}`).join("\n")
    : "- não informadas";
  const codigos = sugeridos.length
    ? sugeridos.map((s) => `- ${s.codigo} (${s.item}) ${s.descricao}`).join("\n")
    : "- nenhum mapeado; use buscar_servico normalmente";

  return `Dados do prestador (quem emite a nota):
- CNPJ: ${prestador.cnpj}
- Razão social: ${prestador.razaoSocial}
- Regime: ${prestador.regime}
- Código IBGE do município: ${prestador.codigoMunicipio}

Atividades registradas no CNPJ (CNAE):
${atividades}

Códigos de serviço compatíveis com as atividades da empresa:
${codigos}

Data de hoje: ${hoje}`;
}

/** Mensagem do histórico como circula entre navegador e servidor. */
export type MensagemChat = ChatCompletionMessageParam;

export interface ResultadoAgente {
  messages: MensagemChat[];
  texto: string;
  rascunho: RascunhoNota | null;
}

interface Ferramenta<T extends z.ZodType> {
  nome: string;
  descricao: string;
  entrada: T;
  executar: (dados: z.infer<T>) => Promise<string>;
}

function ferramenta<T extends z.ZodType>(f: Ferramenta<T>) {
  return f;
}

/**
 * O histórico vem do navegador, então só aceitamos os papéis de conversa. Uma mensagem de sistema
 * ou de desenvolvedor enviada pelo cliente passaria por cima das instruções do assistente.
 */
function limparHistorico(historico: unknown[]): MensagemChat[] {
  return historico.filter((m): m is MensagemChat => {
    if (!m || typeof m !== "object") return false;
    const papel = (m as { role?: unknown }).role;
    return papel === "user" || papel === "assistant" || papel === "tool";
  });
}

export async function executarAgente(historicoBruto: unknown[], prestador: Prestador): Promise<ResultadoAgente> {
  let rascunho: RascunhoNota | null = null;
  const preferidos = servicosCompativeis(prestador.cnaes ?? []).map((s) => s.codigo);

  const ferramentas = [
    ferramenta({
      nome: "consultar_cnpj",
      descricao:
        "Consulta um CNPJ na Receita Federal e devolve razão social, endereço completo e código IBGE do município. Use sempre que o cliente for pessoa jurídica.",
      entrada: z.object({ cnpj: z.string().describe("CNPJ com ou sem pontuação") }),
      executar: async ({ cnpj }) => {
        try {
          return JSON.stringify(await consultarCnpj(cnpj));
        } catch (e) {
          return `ERRO: ${(e as Error).message}`;
        }
      },
    }),
    ferramenta({
      nome: "buscar_servico",
      descricao:
        "Busca o código de tributação nacional (cTribNac, 6 dígitos) da lista de serviços da LC 116 a partir de uma descrição livre. Devolve até 5 candidatos.",
      entrada: z.object({
        descricao: z.string().describe("Palavras-chave do serviço, ex.: 'site', 'consultoria', 'fotografia'"),
      }),
      executar: async ({ descricao }) => {
        const r = buscarServicos(descricao, 5, preferidos);
        if (r.length === 0) return "Nenhum serviço encontrado. Tente outras palavras-chave ou peça mais detalhes ao usuário.";
        return JSON.stringify(
          r.map((s) => ({
            codigo: s.codigo,
            item: s.item,
            descricao: s.descricao,
            compativelComAtividadeDaEmpresa: preferidos.includes(s.codigo),
          })),
        );
      },
    }),
    ferramenta({
      nome: "preparar_nota",
      descricao:
        "Valida e registra o rascunho da nota para o usuário confirmar. Chame apenas quando tiver todos os dados obrigatórios. Não emite a nota.",
      entrada: z.object({
        tomador: z.object({
          documento: z.string().describe("CPF (11 dígitos) ou CNPJ (14 dígitos), só números"),
          nome: z.string(),
          email: z.string().optional(),
          telefone: z.string().optional(),
          endereco: z
            .object({
              logradouro: z.string(),
              numero: z.string(),
              complemento: z.string().optional(),
              bairro: z.string(),
              codigoMunicipio: z.string().describe("Código IBGE, 7 dígitos"),
              cep: z.string().describe("8 dígitos"),
            })
            .optional(),
        }),
        codigoTributacaoNacional: z.string().describe("6 dígitos, vindo de buscar_servico"),
        descricaoServico: z.string(),
        valorServico: z.number(),
        dataCompetencia: z.string().describe("AAAA-MM-DD"),
        issRetido: z.boolean().optional(),
        valorDesconto: z.number().optional(),
      }),
      executar: async (input) => {
        const parsed = RascunhoNotaSchema.safeParse({
          ...input,
          tomador: { ...input.tomador, documento: input.tomador.documento.replace(/\D/g, "") },
          issRetido: input.issRetido ?? false,
        });
        if (!parsed.success) {
          return "ERRO DE VALIDAÇÃO: " + parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        }
        if (!servicoPorCodigo(parsed.data.codigoTributacaoNacional)) {
          return "ERRO: código de tributação desconhecido. Use buscar_servico e escolha um dos códigos devolvidos.";
        }
        rascunho = parsed.data;
        if (codigoCompativel(parsed.data.codigoTributacaoNacional, prestador.cnaes) === false) {
          return "OK: rascunho registrado. ATENÇÃO: esse código não corresponde a nenhuma atividade registrada no CNPJ. Apresente o resumo, avise o usuário disso em uma frase e peça a confirmação.";
        }
        return "OK: rascunho registrado. Agora apresente o resumo ao usuário e peça a confirmação.";
      },
    }),
  ];

  const porNome = new Map(ferramentas.map((f) => [f.nome, f as Ferramenta<z.ZodType>]));
  const tools: ChatCompletionTool[] = ferramentas.map((f) => ({
    type: "function",
    function: {
      name: f.nome,
      description: f.descricao,
      parameters: z.toJSONSchema(f.entrada) as Record<string, unknown>,
    },
  }));

  const hoje = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
  // A parte estável vem primeiro: a OpenAI reaproveita prefixos repetidos entre chamadas.
  const sistema: MensagemChat[] = [
    { role: "system", content: SYSTEM_ESTAVEL },
    { role: "system", content: systemPerfil(prestador, hoje) },
  ];
  const conversa = limparHistorico(historicoBruto);

  for (let rodada = 0; rodada < MAX_RODADAS; rodada++) {
    const resposta = await openai().chat.completions.create({
      model: MODELO,
      messages: [...sistema, ...conversa],
      tools,
      max_completion_tokens: 4096,
      ...(ESFORCO ? { reasoning_effort: ESFORCO } : {}),
    });

    const msg = resposta.choices[0]?.message;
    if (!msg) break;

    if (msg.refusal) {
      conversa.push({ role: "assistant", content: msg.refusal });
      return { messages: conversa, texto: "Não consegui processar esse pedido. Pode reformular?", rascunho: null };
    }

    const chamadas = (msg.tool_calls ?? []).filter((c) => c.type === "function");
    conversa.push({
      role: "assistant",
      content: msg.content ?? null,
      ...(chamadas.length ? { tool_calls: chamadas } : {}),
    });

    if (chamadas.length === 0) {
      return { messages: conversa, texto: (msg.content ?? "").trim(), rascunho };
    }

    for (const chamada of chamadas) {
      const f = porNome.get(chamada.function.name);
      let saida: string;
      if (!f) {
        saida = `ERRO: ferramenta desconhecida ${chamada.function.name}`;
      } else {
        let argumentos: unknown;
        try {
          argumentos = JSON.parse(chamada.function.arguments || "{}");
        } catch {
          argumentos = null;
        }
        const validado = f.entrada.safeParse(argumentos);
        saida = validado.success
          ? await f.executar(validado.data)
          : "ERRO: argumentos inválidos: " + validado.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      }
      conversa.push({ role: "tool", tool_call_id: chamada.id, content: saida });
    }
  }

  return {
    messages: conversa,
    texto: rascunho ? "Rascunho pronto. Confira os dados abaixo." : "Não consegui concluir agora. Pode repetir com mais detalhes?",
    rascunho,
  };
}
