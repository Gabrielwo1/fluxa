"use client";

import { ExternalLink, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SUITE } from "@/lib/suite";

// Menu de módulos da suíte: abre o Radar B2B e o Atendente Syntax em outra aba.
export function SuiteSwitcher() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Módulos da suíte" title="Módulos" className="flex h-10 w-10 items-center justify-center rounded-full border bg-card text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
        <LayoutGrid size={16} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-2">
        <DropdownMenuLabel>Módulos da suíte</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUITE.map((m) => {
          const here = m.id === "fluxa";
          const body = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.icon} alt="" className="h-9 w-9 shrink-0 rounded-full" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-tight">{m.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{m.tagline}</span>
              </span>
              {here ? <span className="rounded-full bg-primary/25 px-2 py-0.5 text-[10px] font-semibold">você está aqui</span> : <ExternalLink size={14} className="shrink-0 text-muted-foreground" />}
            </>
          );
          const cls = "flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted";
          return here ? (
            <Link key={m.id} href="/" className={cls}>{body}</Link>
          ) : (
            <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className={cls}>{body}</a>
          );
        })}
        <DropdownMenuSeparator />
        <Link href="/modulos" className="block rounded-xl px-2 py-2 text-center text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Ver todos os módulos</Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
