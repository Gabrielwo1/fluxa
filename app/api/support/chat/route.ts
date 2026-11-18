import OpenAI from "openai";
import { z } from "zod";
import { route } from "@/lib/api";
import { HttpError, getTenant } from "@/lib/tenant";
import { isDemoSlug } from "@/lib/demo";
import { SYSTEM_SUPORTE, contextoDaPagina } from "@/lib/support/prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

// Modelo mais barato que dá conta de dúvidas de uso. Dá para trocar sem mexer no código: SUPPORT_MODEL.
const MODELO = process.env.SUPPORT_MODEL || "gpt-4.1-nano";
// modelos de raciocínio não aceitam temperatura e cobram os "pensamentos" como saída
const RACIOCINIO = /^(gpt-5|o\d)/.test(MODELO);

const MAX_MENSAGENS = 10; // histórico enviado por chamada
const MAX_CARACTERES = 1200; // por mensagem
const MAX_SAIDA = 450; // tokens da resposta

const BodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(MAX_CARACTERES) }))
    .min(1)
    .max(40),
  path: z.string().max(120).default("/"),
});

// Limite simples por instância, para o custo não fugir do controle:
// empresas reais por código de acesso; demonstrações por IP (cada visitante cria uma empresa nova).
const janela = new Map<string, number[]>();
function excedeu(chave: string, max: number) {
  const agora = Date.now();
  const recentes = (janela.get(chave) ?? []).filter((t) => agora - t < 600_000);
  recentes.push(agora);
  janela.set(chave, recentes);
  if (janela.size > 5000) janela.clear();
  return recentes.length > max;
}

let cliente: OpenAI | null = null;

// Chat de dúvidas e suporte. O navegador só manda a conversa e a página atual; nenhum dado da
// empresa vai para a OpenAI. A resposta sai em texto puro, aos pedaços.
export const POST = route(async (req) => {
  const t = await getTenant();
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, "Mensagem inválida.");
  if (!process.env.OPENAI_API_KEY) throw new HttpError(503, "O assistente ainda não está ativo.");

  const historico = parsed.data.messages.slice(-MAX_MENSAGENS);
  if (historico[0].role !== "user") historico.shift();
  if (historico.length === 0 || historico[historico.length - 1].role !== "user") throw new HttpError(400, "Mensagem inválida.");

  const demo = isDemoSlug(t.clientSlug);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (demo ? excedeu(`ip:${ip}`, 15) : excedeu(`t:${t.clientSlug}`, 30)) {
    throw new HttpError(429, "Muitas perguntas em pouco tempo. Aguarde alguns minutos ou fale com a equipe no WhatsApp.");
  }

  cliente ??= new OpenAI();
  let stream;
  try {
    stream = await cliente.chat.completions.create(
      {
        model: MODELO,
        stream: true,
        stream_options: { include_usage: true },
        max_completion_tokens: RACIOCINIO ? MAX_SAIDA * 6 : MAX_SAIDA,
        ...(RACIOCINIO ? { reasoning_effort: "minimal" as const } : { temperature: 0.3 }),
        messages: [
          { role: "system", content: SYSTEM_SUPORTE },
          { role: "system", content: contextoDaPagina(parsed.data.path, demo) },
          ...historico,
        ],
      },
      { signal: req.signal }
    );
  } catch (e) {
    if (e instanceof OpenAI.RateLimitError) throw new HttpError(429, "O assistente está ocupado. Tente de novo em instantes ou fale com a equipe no WhatsApp.");
    if (e instanceof OpenAI.APIError) {
      console.error("[support] OpenAI", e.status, e.message);
      throw new HttpError(502, "O assistente não conseguiu responder agora. Fale com a equipe no WhatsApp.");
    }
    throw e;
  }

  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(ctrl) {
      try {
        for await (const parte of stream) {
          const texto = parte.choices[0]?.delta?.content;
          if (texto) ctrl.enqueue(enc.encode(texto));
          if (parte.usage) {
            const u = parte.usage;
            console.log(`[support] ${MODELO} entrada=${u.prompt_tokens} (cache=${u.prompt_tokens_details?.cached_tokens ?? 0}) saida=${u.completion_tokens}`);
          }
        }
        ctrl.close();
      } catch (e) {
        // cliente fechou o chat no meio da resposta, ou a OpenAI caiu: encerra o fluxo
        ctrl.error(e);
      }
    },
    cancel() {
      stream.controller.abort();
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
});
