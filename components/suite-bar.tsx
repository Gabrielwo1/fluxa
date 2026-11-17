"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, ChevronDown, Radar, Sparkles } from "lucide-react";
import { NAV_GROUPS } from "@/components/nav-data";
import { SUITE, type SuiteModule } from "@/lib/suite";
import { cn } from "@/lib/utils";

// Endereços dentro de cada ferramenta (só o que já existe nelas hoje).
const RADAR_LINKS = [
  { path: "/app", label: "Prospecção", hint: "Busque empresas por cidade, segmento e porte" },
  { path: "/crm", label: "CRM", hint: "Acompanhe seus leads por etapa" },
  { path: "/automacao", label: "Automação IA", hint: "Mensagens automáticas para os leads" },
  { path: "/planos", label: "Planos", hint: "Consulta avulsa ou Pro" },
];

// Menu superior da suíte: uma aba por ferramenta e, ao abrir, um painel largo (mega menu)
// com os atalhos de cada uma. Fluxa abre na mesma aba; as outras ferramentas, em nova aba.
export function SuiteBar() {
  const pathname = usePathname();
  // o painel só vale na página em que foi aberto; ao navegar, fecha sozinho
  const [state, setState] = useState<{ id: SuiteModule["id"]; path: string } | null>(null);
  const openId = state && state.path === pathname ? state.id : null;
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!openId) return;
    const out = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setState(null);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setState(null);
    document.addEventListener("mousedown", out);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", out);
      document.removeEventListener("keydown", esc);
    };
  }, [openId]);

  const open = (id: SuiteModule["id"]) => setState({ id, path: pathname });
  const clear = () => timer.current && clearTimeout(timer.current);

  const mod = SUITE.find((m) => m.id === openId);

  return (
    <div
      ref={box}
      className="sticky top-0 z-40 px-3 pt-3 lg:px-4 print:hidden"
      onMouseLeave={() => {
        clear();
        timer.current = setTimeout(() => setState(null), 220);
      }}
      onMouseEnter={clear}
    >
      <div className="flex items-center gap-3 rounded-full bg-ink p-1.5 pr-3 shadow-[0_12px_30px_-16px_rgb(20_21_24/0.6)]">
        <Link href="/" aria-label="Fluxa, início" className="ml-1 grid size-9 shrink-0 place-items-center rounded-full bg-lime text-ink">
          <Radar className="size-[18px]" />
        </Link>
        <nav aria-label="Ferramentas da suíte" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
          {SUITE.map((m) => {
            const here = m.id === "fluxa";
            const active = openId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                aria-expanded={active}
                aria-haspopup="true"
                onClick={() => (active ? setState(null) : open(m.id))}
                onMouseEnter={() => {
                  clear();
                  if (window.matchMedia("(hover: hover)").matches) timer.current = setTimeout(() => open(m.id), 120);
                }}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition",
                  here ? "bg-lime text-ink" : active ? "bg-white/15 text-white" : "text-white/75 hover:text-white"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.icon} alt="" className="hidden size-5 rounded-full sm:block" />
                <span className="sm:hidden">{m.name.split(" ")[0]}</span>
                <span className="hidden sm:inline">{m.name}</span>
                <ChevronDown size={14} className={cn("transition", active && "rotate-180")} />
              </button>
            );
          })}
        </nav>
        <Link href="/modulos" className="hidden shrink-0 text-xs font-medium text-white/60 hover:text-white md:block">Ver todos</Link>
      </div>

      {mod && (
        <div
          role="region"
          aria-label={`Menu ${mod.name}`}
          className="glass-panel absolute inset-x-3 top-[calc(100%-2px)] mt-2 max-h-[calc(100dvh-100px)] overflow-y-auto rounded-[28px] p-5 lg:inset-x-4 lg:p-6"
        >
          {mod.id === "fluxa" ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
              {NAV_GROUPS.map((g) => (
                <div key={g.label ?? "inicio"}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.label ?? "Visão geral"}</p>
                  <ul className="space-y-0.5">
                    {g.items.map(({ href, label, Icon }) => (
                      <li key={href}>
                        <Link href={href} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm font-medium transition-colors hover:bg-white">
                          <Icon size={15} />
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div>
                <div className="mb-3 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mod.icon} alt="" className="size-11 rounded-full" />
                  <div>
                    <p className="text-lg font-semibold leading-tight">{mod.name}</p>
                    <p className="text-xs text-muted-foreground">{mod.tagline}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{mod.description}</p>
                <a href={mod.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-coal-2">
                  Abrir {mod.name} <ArrowUpRight size={15} />
                </a>
              </div>
              <div>
                {mod.id === "radar" ? (
                  <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {RADAR_LINKS.map((l) => (
                      <li key={l.path}>
                        <a href={`${mod.url}${l.path}`} target="_blank" rel="noreferrer" className="block rounded-2xl border border-white/80 bg-white/60 p-3 transition-colors hover:bg-white">
                          <span className="flex items-center justify-between text-sm font-semibold">{l.label} <ArrowUpRight size={13} className="text-muted-foreground" /></span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">{l.hint}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {mod.features.map((f) => (
                      <li key={f} className="rounded-2xl border border-white/80 bg-white/60 p-3 text-sm font-medium">{f}</li>
                    ))}
                  </ul>
                )}
                {mod.soon && (
                  <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full bg-lime px-2.5 py-1 font-semibold text-ink"><Sparkles size={11} /> Em breve</span>
                    {mod.soon.join(" · ")}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
