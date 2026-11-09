"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/erp/toaster";
import { Button } from "@/components/ui/button";
import { BrandMark, ThemeToggle } from "@/components/site/site-header";
import { cn } from "@/lib/utils";

export type ProposalSlide = { id: string; title: string; node: React.ReactNode };

// Apresentação em tela cheia que corre para o lado: arrastar com o dedo no celular,
// setas do teclado ou botões no computador. O slide atual fica no endereço (#3).
export function Proposal({ slides }: { slides: ProposalSlide[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const total = slides.length;

  const go = useCallback(
    (i: number, instant = false) => {
      const el = track.current;
      if (!el) return;
      const target = Math.min(Math.max(i, 0), total - 1);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollTo({ left: target * el.clientWidth, behavior: instant || reduce ? "auto" : "smooth" });
    },
    [total]
  );

  // abre direto no slide do endereço e mantém o alinhamento quando a tela gira ou redimensiona
  useEffect(() => {
    const n = parseInt(window.location.hash.slice(1), 10);
    if (Number.isFinite(n) && n > 1) go(n - 1, true);
    const onResize = () => {
      const el = track.current;
      if (el) el.scrollTo({ left: Math.round(el.scrollLeft / Math.max(1, el.clientWidth)) * el.clientWidth });
    };
    // links internos como href="#3" levam ao slide
    const onHash = () => {
      const h = parseInt(window.location.hash.slice(1), 10);
      if (Number.isFinite(h)) go(h - 1);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("hashchange", onHash);
    };
  }, [go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (["ArrowRight", "PageDown"].includes(e.key)) {
        e.preventDefault();
        go(index + 1);
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        go(index - 1);
      } else if (e.key === "Home") go(0);
      else if (e.key === "End") go(total - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, total]);

  function onScroll() {
    const el = track.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (i !== index) {
      setIndex(i);
      window.history.replaceState(null, "", `#${i + 1}`);
    }
  }

  async function share() {
    const url = window.location.href.split("#")[0];
    try {
      if (navigator.share) await navigator.share({ title: document.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado.");
      }
    } catch {
      // compartilhamento cancelado
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <header className="flex items-center gap-3 px-4 py-2 md:px-8">
        <BrandMark />
        <div className="ml-auto flex items-center gap-2">
          <span className="mr-1 text-xs font-medium tabular-nums text-muted-foreground" aria-live="polite">
            {index + 1} / {total}
          </span>
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full bg-card" onClick={share} aria-label="Compartilhar esta proposta" title="Compartilhar">
            <Share2 size={16} />
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-4 h-1 overflow-hidden rounded-full bg-muted md:mx-8" aria-hidden>
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>

      <div
        ref={track}
        onScroll={onScroll}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="region"
        aria-roledescription="carrossel"
        aria-label="Proposta"
      >
        {slides.map((s, i) => (
          <section
            key={s.id}
            aria-roledescription="slide"
            aria-label={`${i + 1} de ${total}: ${s.title}`}
            aria-hidden={i !== index}
            className="h-full w-full shrink-0 snap-center snap-always overflow-y-auto overscroll-y-contain"
          >
            <div className="mx-auto flex h-full w-full max-w-5xl flex-col justify-center px-5 py-3 md:px-10 md:py-4">{s.node}</div>
          </section>
        ))}
      </div>

      <footer className="flex items-center justify-between gap-3 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 md:px-8">
        <Button variant="outline" className="h-11 w-11 rounded-full bg-card p-0 md:w-auto md:px-5" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Slide anterior">
          <ChevronLeft size={18} /> <span className="hidden md:inline">Anterior</span>
        </Button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5" role="tablist" aria-label="Slides">
          {slides.map((s, i) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={i === index}
              aria-label={`Ir para ${s.title}`}
              title={s.title}
              onClick={() => go(i)}
              className={cn("h-2 rounded-full transition-all", i === index ? "w-6 bg-primary" : "w-2 bg-border hover:bg-muted-foreground/50", Math.abs(i - index) > 3 && "hidden md:block")}
            />
          ))}
        </div>
        <Button className="h-11 w-11 rounded-full p-0 font-semibold md:w-auto md:px-6" onClick={() => go(index + 1)} disabled={index === total - 1} aria-label="Próximo slide">
          <span className="hidden md:inline">Próximo</span> <ChevronRight size={18} />
        </Button>
      </footer>
      <Toaster />
    </div>
  );
}
