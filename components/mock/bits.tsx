"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { call, useApi } from "@/lib/erp/client";

// Faixa que avisa que a tela é uma prévia com dados fictícios e coleta o interesse ("quero ser avisado").
export function PreviewBanner({ feature, title, children }: { feature: string; title: string; children: React.ReactNode }) {
  const { data, reload } = useApi<{ features: string[] }>("/api/erp/interest");
  const [busy, setBusy] = useState(false);
  const done = data?.features.includes(feature);

  async function want() {
    setBusy(true);
    try {
      await call("POST", "/api/erp/interest", { feature });
      toast.success("Anotado! Avisamos quando estiver no ar.");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-ink p-4 text-white">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-lime text-ink"><Sparkles size={16} /></span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title} <span className="ml-1 rounded-full bg-lime px-2 py-0.5 text-[11px] font-semibold text-ink">prévia</span></p>
          <p className="text-xs text-white/65">{children}</p>
        </div>
      </div>
      <Button onClick={want} disabled={busy || done} className="rounded-full bg-lime text-ink hover:bg-lime-deep">
        {done ? <><Check size={15} /> Você será avisado</> : "Quero ser avisado"}
      </Button>
    </div>
  );
}

// cartão de vidro, mesmo do Radar B2B
export const Glass = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <section className={`glass rounded-[28px] p-5 ${className}`}>{children}</section>
);

export const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(n));
