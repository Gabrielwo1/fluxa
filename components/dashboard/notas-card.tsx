"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Sparkles } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui-kit";
import { buttonVariants } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { carregarResumo } from "@/lib/nfse-client";
import type { Resumo } from "@/lib/financeiro";

/**
 * Lado fiscal no painel: quanto já foi faturado em nota neste ano e o quanto falta para o teto.
 * Só aparece para quem tem emitente cadastrado — quem não usa a parte fiscal não vê nada.
 */
export function NotasCard() {
  const [resumo, setResumo] = useState<Resumo | null>(null);

  useEffect(() => {
    carregarResumo().then(setResumo);
  }, []);

  if (!resumo) return null;

  const pct = Math.min(100, Math.round(resumo.percentualLimite));
  return (
    <Panel>
      <PanelHeader
        title="Notas fiscais"
        subtitle={`${resumo.totalNotas} ${resumo.totalNotas === 1 ? "nota" : "notas"} no ano`}
        right={
          <Link
            href="/notas"
            className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            ver todas
          </Link>
        }
      />
      <p className="text-2xl font-semibold tabular-nums">{brl.format(resumo.anoAtual)}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${pct >= 90 ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {pct}% do limite anual de {brl.format(resumo.limiteAnual)}
        {resumo.pendentes > 0 ? ` · ${resumo.pendentes} em emissão` : ""}
      </p>
      <div className="mt-4 flex gap-2">
        <Link href="/emitir" className={`${buttonVariants({ size: "sm" })} flex-1`}>
          <Sparkles /> Emitir nota
        </Link>
        <Link href="/notas" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <FileText /> Notas
        </Link>
      </div>
    </Panel>
  );
}
