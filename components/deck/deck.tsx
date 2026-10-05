"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  LayoutGrid,
  Minimize2,
  Presentation as PresentationIcon,
  Printer,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/site/site-header";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export type Slide = { id: string; title: string; node: React.ReactNode };

// o slide atual vive no hash da URL (#3), então dá para compartilhar o link de um slide
function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
const readHash = () => {
  const n = parseInt(window.location.hash.slice(1), 10);
  return Number.isFinite(n) ? n : 1;
};

export function Deck({ slides }: { slides: Slide[] }) {
  const raw = useSyncExternalStore(subscribe, readHash, () => 1);
  const total = slides.length;
  const index = Math.min(Math.max(raw, 1), total) - 1;
  const [all, setAll] = useState(false);
  const [full, setFull] = useState(false);
  const [touchX, setTouchX] = useState<number | null>(null);

  const go = useCallback(
    (i: number) => {
      const next = Math.min(Math.max(i, 0), total - 1);
      window.history.replaceState(null, "", `#${next + 1}`);
      window.dispatchEvent(new Event("hashchange"));
    },
    [total]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target;
      if (el instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) {
        e.preventDefault();
        go(index + 1);
      } else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) {
        e.preventDefault();
        go(index - 1);
      } else if (e.key === "Home") go(0);
      else if (e.key === "End") go(total - 1);
      else if (e.key === "g") setAll((a) => !a);
    };
    const onFull = () => setFull(Boolean(document.fullscreenElement));
    const onAfterPrint = () => setAll(false);
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFull);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFull);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [go, index, total]);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }

  function printAll() {
    setAll(true);
    // espera os slides renderizarem em sequência antes de abrir a impressão
    setTimeout(() => window.print(), 400);
  }

  const bar = (
    <header className="flex items-center gap-3 border-b bg-background/90 px-4 py-2.5 backdrop-blur print:hidden md:px-6">
      <Link href="/lp" className="flex items-center gap-2 text-sm font-bold tracking-tight">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <PresentationIcon size={14} />
        </span>
        {BRAND.name}
      </Link>
      <span className="hidden truncate text-sm text-muted-foreground sm:block">
        {all ? "Todos os slides" : slides[index].title}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        {!all && (
          <span className="mr-2 text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {index + 1} / {total}
          </span>
        )}
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full"
          onClick={() => setAll((a) => !a)}
          aria-label={all ? "Voltar aos slides" : "Ver todos os slides"}
          title="Ver todos (G)"
        >
          <LayoutGrid size={15} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="hidden h-9 w-9 rounded-full sm:inline-flex"
          onClick={printAll}
          aria-label="Salvar em PDF"
          title="Salvar em PDF"
        >
          <Printer size={15} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="hidden h-9 w-9 rounded-full sm:inline-flex"
          onClick={toggleFullscreen}
          aria-label={full ? "Sair da tela cheia" : "Tela cheia"}
          title="Tela cheia"
        >
          {full ? <Minimize2 size={15} /> : <Expand size={15} />}
        </Button>
        <ThemeToggle />
        <Link
          href="/lp"
          aria-label="Fechar apresentação"
          className={cn(buttonVariants({ variant: "outline", size: "icon" }), "h-9 w-9 rounded-full")}
        >
          <X size={15} />
        </Link>
      </div>
    </header>
  );

  if (all) {
    return (
      <div className="min-h-screen bg-background">
        {bar}
        <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8 print:space-y-0 print:p-0">
          {slides.map((s, i) => (
            <section
              key={s.id}
              className="flex min-h-[70vh] items-center rounded-3xl border bg-card p-6 md:p-12 print:min-h-screen print:break-after-page print:rounded-none print:border-0"
            >
              <div className="w-full">
                <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground print:hidden">
                  {i + 1} / {total}
                </p>
                {s.node}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {bar}
      <div className="h-1 w-full bg-muted print:hidden" aria-hidden>
        <div
          className="h-full bg-primary transition-[width] duration-300"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      <main
        className="relative flex-1 overflow-y-auto"
        aria-label={`Slide ${index + 1} de ${total}: ${slides[index].title}`}
        onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX === null) return;
          const dx = e.changedTouches[0].clientX - touchX;
          if (Math.abs(dx) > 60) go(index + (dx < 0 ? 1 : -1));
          setTouchX(null);
        }}
      >
        <div
          key={index}
          className="mx-auto flex min-h-full w-full max-w-7xl animate-[slide-in_0.35s_ease-out] items-center px-5 py-8 md:px-14"
        >
          <div className="w-full">{slides[index].node}</div>
        </div>
      </main>

      <footer className="flex items-center justify-between gap-3 border-t bg-background/90 px-4 py-3 print:hidden md:px-6">
        <Button
          variant="outline"
          className="h-10 rounded-full px-4"
          onClick={() => go(index - 1)}
          disabled={index === 0}
        >
          <ChevronLeft size={16} /> <span className="hidden sm:inline">Anterior</span>
        </Button>
        <div className="hidden items-center gap-1.5 md:flex" role="tablist" aria-label="Slides">
          {slides.map((s, i) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={i === index}
              aria-label={`Ir para o slide ${i + 1}: ${s.title}`}
              title={s.title}
              onClick={() => go(i)}
              className={cn(
                "h-2 rounded-full transition-all",
                i === index ? "w-6 bg-primary" : "w-2 bg-border hover:bg-muted-foreground/50"
              )}
            />
          ))}
        </div>
        <Button
          className="h-10 rounded-full px-5 font-semibold"
          onClick={() => go(index + 1)}
          disabled={index === total - 1}
        >
          <span className="hidden sm:inline">Próximo</span> <ChevronRight size={16} />
        </Button>
      </footer>
    </div>
  );
}
