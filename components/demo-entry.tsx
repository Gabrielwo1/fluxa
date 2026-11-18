"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/site/site-header";

const POINTS = [
  "Uma empresa de exemplo só sua, com clientes, vendas, estoque e contas já preenchidos",
  "Pode cadastrar, vender, cancelar e apagar à vontade: nada afeta ninguém",
  "Veja também a prévia da prospecção (Radar Empresas) e da IA no WhatsApp",
  "Os dados são fictícios e somem sozinhos em 24 horas",
];

// Porta de entrada pública da demonstração: um clique cria a empresa fictícia e abre o sistema.
export function DemoEntry() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enter() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/enter", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível abrir a demonstração.");
      // recarrega por completo para o sistema abrir já com a sessão nova
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-10">
      <BrandMark className="mb-8" />
      <p className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Teste grátis, sem cadastro
      </p>
      <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.03em] sm:text-5xl">
        Experimente o sistema <span className="bg-[linear-gradient(transparent_62%,color-mix(in_oklch,var(--primary)_75%,transparent)_62%)] px-0.5">por dentro</span>.
      </h1>
      <p className="mt-4 text-base text-muted-foreground md:text-lg">
        Abrimos uma empresa de demonstração só para você. Em um clique você já está dentro, mexendo em tudo.
      </p>
      <ul className="mt-6 space-y-2.5">
        {POINTS.map((t) => (
          <li key={t} className="flex items-start gap-3 text-[15px]">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-lime"><Check size={12} strokeWidth={3} /></span>
            {t}
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button onClick={enter} disabled={busy} className="h-14 rounded-full px-8 text-base font-medium">
          {busy ? <><Loader2 size={18} className="animate-spin" /> Preparando sua demonstração…</> : <>Abrir a demonstração <ArrowRight size={18} /></>}
        </Button>
        <span className="flex items-center gap-2 text-sm text-muted-foreground"><Smartphone size={15} /> Funciona no celular</span>
      </div>
      {error && <p role="alert" className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
    </main>
  );
}
