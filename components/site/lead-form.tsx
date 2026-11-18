"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { WHATSAPP } from "@/lib/brand";

const SIZES = [
  "Até R$ 6.750 por mês (limite do MEI)",
  "De R$ 6.750 a R$ 20 mil por mês",
  "De R$ 20 mil a R$ 100 mil por mês",
  "Mais de R$ 100 mil por mês",
];

const CONTROLS = ["Caderno ou anotações", "Planilha", "Outro sistema", "Não controlo ainda"];

const field =
  "h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-sm text-background outline-none placeholder:text-background/50 focus:border-primary focus:ring-2 focus:ring-primary/40";

function utmFromUrl(): Record<string, string> {
  const out: Record<string, string> = {};
  const params = new URLSearchParams(window.location.search);
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const v = params.get(k);
    if (v) out[k] = v.slice(0, 120);
  }
  return out;
}

export function LeadForm() {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const { control, pain, ...data } = Object.fromEntries(new FormData(form).entries());
    // o campo "pain" da base guarda o texto livre; o controle atual vai junto, como prefixo
    const note = [control ? `Controla hoje: ${control}.` : "", String(pain ?? "").trim()].filter(Boolean).join(" ");
    setState("sending");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, pain: note, ...utmFromUrl() }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState("done");
      form.reset();
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div
        role="status"
        className="rounded-3xl bg-background p-8 text-center text-foreground"
      >
        <CheckCircle2 size={40} className="mx-auto text-good" />
        <h3 className="mt-4 text-xl font-bold">Recebemos o seu pedido</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Vamos entrar em contato para liberar o seu acesso. Enquanto isso, que tal testar?
        </p>
        <a
          href="/demo"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
        >
          Testar agora, sem cadastro
        </a>
        {WHATSAPP && (
          <a
            href={`https://wa.me/${WHATSAPP}`}
            className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
          >
            Falar agora pelo WhatsApp
          </a>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-3xl bg-background/5 p-5 ring-1 ring-white/10 md:p-6"
      aria-label="Pedir acesso antecipado"
    >
      {/* campo-armadilha para robôs: pessoas não veem nem preenchem */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-background/70">Seu nome *</span>
          <input name="name" required maxLength={120} autoComplete="name" className={field} placeholder="Como podemos te chamar" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-background/70">WhatsApp</span>
          <input name="phone" type="tel" maxLength={30} autoComplete="tel" className={field} placeholder="(00) 00000-0000" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-background/70">E-mail *</span>
          <input name="email" type="email" required maxLength={160} autoComplete="email" className={field} placeholder="voce@email.com" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-background/70">Nome do seu negócio *</span>
          <input name="company" required maxLength={160} autoComplete="organization" className={field} placeholder="Ex.: Doces da Ana" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-background/70">Quanto vende por mês, mais ou menos?</span>
          <select name="size" defaultValue="" className={`${field} appearance-none`}>
            <option value="" className="text-foreground">Prefiro informar depois</option>
            {SIZES.map((s) => (
              <option key={s} value={s} className="text-foreground">
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-background/70">Como controla o negócio hoje?</span>
          <select name="control" defaultValue="" className={`${field} appearance-none`}>
            <option value="" className="text-foreground">Prefiro não dizer</option>
            {CONTROLS.map((c) => (
              <option key={c} value={c} className="text-foreground">
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-background/70">O que mais te atrapalha hoje?</span>
        <textarea
          name="pain"
          rows={3}
          maxLength={560}
          className={`${field} h-auto resize-none py-3`}
          placeholder="Ex.: não sei quanto sobrou, cliente que não paga, estoque…"
        />
      </label>
      <label className="flex items-start gap-3 text-xs text-background/70">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
        />
        <span>
          Concordo em receber contato sobre o meu acesso e com o tratamento dos
          meus dados conforme a{" "}
          <a href="/lp/privacidade" className="font-medium text-background underline">
            política de privacidade
          </a>
          . *
        </span>
      </label>
      <button
        type="submit"
        disabled={state === "sending"}
        className="flex h-13 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {state === "sending" ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Enviando…
          </>
        ) : (
          "Quero acesso antecipado"
        )}
      </button>
      {state === "error" && (
        <p role="alert" className="text-center text-sm text-[#fda4af]">
          Não conseguimos enviar agora. Tente de novo em instantes.
        </p>
      )}
    </form>
  );
}
