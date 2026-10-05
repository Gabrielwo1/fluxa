"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/components/finance-provider";

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-3xl border bg-card p-5 text-card-foreground shadow-[0_1px_2px_rgb(0_0_0/0.03)]",
        className
      )}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold leading-tight">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

// variação em relação a um valor de referência; seta + sinal + cor
// (a cor nunca é o único sinal)
export function Trend({
  current,
  previous,
  goodWhenUp = true,
  suffix = "vs mês anterior",
}: {
  current: number;
  previous: number;
  goodWhenUp?: boolean;
  suffix?: string;
}) {
  if (previous <= 0) {
    return <p className="text-xs text-muted-foreground">sem base para comparar</p>;
  }
  const diff = ((current - previous) / previous) * 100;
  const up = diff >= 0;
  const good = up === goodWhenUp;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <p className="flex items-center gap-1 text-xs text-muted-foreground">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 font-semibold",
          good ? "text-good" : "text-bad"
        )}
      >
        <Icon size={13} strokeWidth={2.4} />
        {up ? "+" : "−"}
        {Math.abs(diff).toFixed(1).replace(".", ",")}%
      </span>
      {suffix}
    </p>
  );
}

export function EmptyConnect() {
  const { startConnect, connecting, startSandbox, sandboxStatus } = useFinance();
  return (
    <Panel className="border-dashed py-14 text-center">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/25">
        <Link2 size={22} />
      </span>
      <h2 className="text-lg font-semibold">Nenhum banco conectado</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Conecte sua conta do Meu Pluggy para trazer saldos, cartões,
        investimentos e transações — ou use o modo teste para ver o painel com
        dados fictícios.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button
          className="rounded-full px-5 font-semibold"
          onClick={startConnect}
          disabled={connecting}
        >
          {connecting ? "Abrindo…" : "Conectar banco"}
        </Button>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={startSandbox}
          disabled={sandboxStatus !== null}
        >
          {sandboxStatus ?? "Modo teste"}
        </Button>
      </div>
    </Panel>
  );
}

export function PageLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      {children}
    </Link>
  );
}
