"use client";

import { useState } from "react";
import Link from "next/link";
import { Leaf, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { CtaLink } from "./cta";

const LINKS = [
  { href: "/lp#solucao", label: "O que faz" },
  { href: "/lp#suite", label: "Suíte" },
  { href: "/lp#como-funciona", label: "Como começar" },
  { href: "/lp#calcule", label: "Faça a conta" },
  { href: "/lp#faq", label: "Perguntas" },
];

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <Link href="/lp" className={`flex items-center gap-2.5 ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Leaf size={18} strokeWidth={2.2} />
      </span>
      <span className="text-lg font-bold tracking-tight">{BRAND.name}</span>
    </Link>
  );
}

// Só há o tema claro, igual ao Radar B2B e ao Atendente Syntax. Mantido para não quebrar quem importa.
export function ThemeToggle() {
  return null;
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-5 md:px-8">
        <BrandMark />
        <nav className="ml-8 hidden items-center gap-1 lg:flex" aria-label="Seções da página">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <CtaLink href="/demo" className="hidden h-10 px-5 text-sm sm:inline-flex">
            Testar agora
          </CtaLink>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full bg-card lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </Button>
        </div>
      </div>
      {open && (
        <nav
          className="border-t bg-background px-5 py-3 lg:hidden"
          aria-label="Seções da página"
        >
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-3 text-base font-medium hover:bg-muted"
            >
              {l.label}
            </a>
          ))}
          <a
            href="/demo"
            onClick={() => setOpen(false)}
            className="mt-2 block rounded-full bg-primary px-4 py-3 text-center font-semibold text-primary-foreground"
          >
            Testar agora
          </a>
        </nav>
      )}
    </header>
  );
}
