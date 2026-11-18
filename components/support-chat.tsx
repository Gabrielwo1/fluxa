"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp, Loader2, MessageCircle, Sparkles, X } from "lucide-react";
import { BRAND, WHATSAPP } from "@/lib/brand";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };

const SUGESTOES = [
  "Como lanço uma venda?",
  "Errei uma venda, e agora?",
  "Como dar baixa numa conta a receber?",
  "Como registro uma nota fiscal?",
];

const BOAS_VINDAS = `Oi! Eu sou o assistente do ${BRAND.name}. Tiro dúvidas de como usar o sistema e, se precisar de uma pessoa, a equipe te atende no WhatsApp.`;

// Texto simples do modelo → React: **negrito**, listas com hífen e quebras de linha (sem HTML bruto).
function Texto({ children }: { children: string }) {
  const blocos = children.split("\n");
  return (
    <>
      {blocos.map((linha, i) => {
        const item = /^\s*[-•*]\s+(.*)$/.exec(linha);
        const conteudo = (item ? item[1] : linha).split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
          p.startsWith("**") && p.endsWith("**") ? <strong key={j}>{p.slice(2, -2)}</strong> : <Fragment key={j}>{p}</Fragment>
        );
        return item ? (
          <span key={i} className="flex gap-2 pl-1">
            <span aria-hidden>•</span>
            <span className="min-w-0">{conteudo}</span>
          </span>
        ) : (
          <Fragment key={i}>
            {conteudo}
            {i < blocos.length - 1 && <br />}
          </Fragment>
        );
      })}
    </>
  );
}

function linkWhatsApp(empresa: string | undefined, pergunta: string | undefined) {
  const partes = [`Olá! Preciso de ajuda com o ${BRAND.name}.`];
  if (empresa) partes.push(`Empresa: ${empresa}.`);
  if (pergunta) partes.push(`Minha dúvida: ${pergunta.slice(0, 300)}`);
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(partes.join(" "))}`;
}

function BotaoWhatsApp({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full bg-[#25d366] px-4 text-sm font-semibold text-[#06361a] shadow-[0_8px_20px_-10px_rgb(37_211_102/0.9)] transition hover:bg-[#20c05c]",
        className
      )}
    >
      <MessageCircle size={16} strokeWidth={2.4} />
      {children}
    </a>
  );
}

// Chat de dúvidas e suporte: botão flutuante que abre um painel. O botão do WhatsApp aparece assim
// que o chat abre e de novo dentro das respostas que encaminham para a equipe.
export function SupportChat({ company, demo }: { company?: string; demo?: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) campo.current?.focus();
  }, [open]);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [msgs, open]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  useEffect(() => () => ctrl.current?.abort(), []);

  const ultimaPergunta = [...msgs].reverse().find((m) => m.role === "user")?.content;

  async function enviar(pergunta: string) {
    const q = pergunta.trim();
    if (!q || busy) return;
    const conversa: Msg[] = [...msgs.filter((m) => !m.error), { role: "user", content: q }];
    setMsgs([...conversa, { role: "assistant", content: "" }]);
    setText("");
    setBusy(true);
    ctrl.current = new AbortController();

    const falha = (mensagem: string) =>
      setMsgs([...conversa, { role: "assistant", content: mensagem, error: true }]);

    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversa.map(({ role, content }) => ({ role, content })), path }),
        signal: ctrl.current.signal,
      });
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        falha(json.error ?? "Não consegui responder agora. Tente de novo ou fale com a equipe.");
        return;
      }
      const leitor = res.body.getReader();
      const dec = new TextDecoder();
      let acumulado = "";
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        acumulado += dec.decode(value, { stream: true });
        setMsgs([...conversa, { role: "assistant", content: acumulado }]);
      }
      if (!acumulado.trim()) falha("Não consegui responder agora. Tente de novo ou fale com a equipe.");
    } catch (e) {
      if ((e as Error).name !== "AbortError") falha("A conexão caiu no meio da resposta. Tente de novo ou fale com a equipe.");
    } finally {
      setBusy(false);
    }
  }

  function fechar() {
    setOpen(false);
  }

  return (
    <div className="print:hidden">
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-[88px] right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-ink pl-3 pr-4 text-sm font-semibold text-white shadow-[0_14px_30px_-12px_rgb(20_21_24/0.7)] transition hover:bg-coal-2 lg:bottom-5 lg:right-5"
          aria-label="Abrir o chat de ajuda"
        >
          <span className="grid size-7 place-items-center rounded-full bg-lime text-ink">
            <MessageCircle size={16} strokeWidth={2.4} />
          </span>
          Ajuda
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="Chat de ajuda"
          className="glass-panel fixed inset-x-3 bottom-[88px] top-20 z-50 flex flex-col overflow-hidden rounded-[28px] sm:inset-x-auto sm:right-4 sm:top-auto sm:h-[min(620px,calc(100dvh-110px))] sm:w-[390px] lg:bottom-5 lg:right-5"
        >
          <header className="flex items-center gap-3 bg-ink px-4 py-3 text-white">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lime text-ink">
              <Sparkles size={18} />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm font-semibold">Assistente {BRAND.name}</p>
              <p className="text-xs text-white/60">Tira dúvidas e leva você ao suporte</p>
            </div>
            <button
              type="button"
              onClick={fechar}
              className="grid size-9 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Fechar o chat"
            >
              <X size={18} />
            </button>
          </header>

          {WHATSAPP && (
            <div className="border-b border-ink/10 bg-white/60 px-4 py-2.5">
              <BotaoWhatsApp href={linkWhatsApp(company, ultimaPergunta)} className="h-10 w-full">
                Falar com a equipe no WhatsApp
              </BotaoWhatsApp>
            </div>
          )}

          <div className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            <p className="max-w-[88%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm shadow-sm">{BOAS_VINDAS}</p>

            {msgs.length === 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => enviar(s)}
                    className="rounded-full border border-ink/15 bg-white/70 px-3 py-1.5 text-left text-xs font-medium transition hover:border-ink/40 hover:bg-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {msgs.map((m, i) =>
              m.role === "user" ? (
                <p key={i} className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-ink px-3.5 py-2.5 text-sm text-white">
                  {m.content}
                </p>
              ) : (
                <div key={i} className="max-w-[92%] space-y-2">
                  <div
                    className={cn(
                      "break-words rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm shadow-sm",
                      m.error ? "bg-destructive/10 text-destructive" : "bg-white"
                    )}
                  >
                    {m.content ? <Texto>{m.content}</Texto> : <Loader2 size={16} className="animate-spin text-muted-foreground" aria-label="Digitando" />}
                  </div>
                  {WHATSAPP && (m.error || /whatsapp/i.test(m.content)) && !(busy && i === msgs.length - 1) && (
                    <BotaoWhatsApp href={linkWhatsApp(company, ultimaPergunta)} className="h-9">
                      Chamar no WhatsApp
                    </BotaoWhatsApp>
                  )}
                </div>
              )
            )}
            <div ref={fim} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar(text);
            }}
            className="border-t border-ink/10 bg-white/60 p-3"
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={campo}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    enviar(text);
                  }
                }}
                rows={1}
                maxLength={1000}
                placeholder="Escreva sua dúvida…"
                aria-label="Sua dúvida"
                className="max-h-28 min-h-10 flex-1 resize-none rounded-2xl border border-ink/15 bg-white px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ink/50 focus:ring-2 focus:ring-lime/60"
              />
              <button
                type="submit"
                disabled={busy || !text.trim()}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-lime text-ink transition hover:bg-lime-deep disabled:opacity-40"
                aria-label="Enviar"
              >
                {busy ? <Loader2 size={17} className="animate-spin" /> : <ArrowUp size={18} strokeWidth={2.6} />}
              </button>
            </div>
            <p className="mt-2 px-1 text-[11px] leading-snug text-muted-foreground">
              {demo ? "Você está na demonstração. " : ""}A IA pode errar. Não envie senhas nem dados de cartão.
            </p>
          </form>
        </section>
      )}
    </div>
  );
}
