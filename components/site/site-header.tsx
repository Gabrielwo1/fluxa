"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Leaf, Menu, Moon, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { CtaLink } from "./cta";

const LINKS = [
  { href: "#solucao", label: "Solução" },
  { href: "#sob-medida", label: "Sob medida" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#seguranca", label: "Segurança" },
  { href: "#faq", label: "Perguntas" },
];

const noop = () => () => {};

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

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <Button
      variant="outline"
      size="icon"
      className="h-10 w-10 rounded-full bg-card"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Mudar para tema claro" : "Mudar para tema escuro"}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </Button>
  );
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
          <CtaLink href="#diagnostico" className="hidden h-10 px-5 text-sm sm:inline-flex">
            Agendar diagnóstico
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
            href="#diagnostico"
            onClick={() => setOpen(false)}
            className="mt-2 block rounded-full bg-primary px-4 py-3 text-center font-semibold text-primary-foreground"
          >
            Agendar diagnóstico
          </a>
        </nav>
      )}
    </header>
  );
}
