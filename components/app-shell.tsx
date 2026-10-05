"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  ArrowLeftRight,
  LayoutDashboard,
  Leaf,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFinance } from "@/components/finance-provider";
import { BRAND } from "@/lib/brand";
import { createClient } from "@/lib/supabase/browser";

const NAV = [
  { href: "/", label: "Visão geral", Icon: LayoutDashboard },
  { href: "/transacoes", label: "Transações", Icon: ArrowLeftRight },
  { href: "/contas", label: "Contas", Icon: Wallet },
  { href: "/investimentos", label: "Investimentos", Icon: TrendingUp },
  { href: "/contas-fixas", label: "Contas fixas", Icon: Receipt },
];

const COLLAPSE_KEY = "sidebar-collapsed";
const COLLAPSE_EVENT = "sidebar-collapsed-change";

function subscribeCollapsed(cb: () => void) {
  window.addEventListener(COLLAPSE_EVENT, cb);
  return () => window.removeEventListener(COLLAPSE_EVENT, cb);
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

const noopSubscribe = () => () => {};

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
  const dark = mounted && resolvedTheme === "dark";
  return (
    <Button
      variant="outline"
      size="icon"
      className="h-10 w-10 rounded-full bg-card"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={dark ? "Tema claro" : "Tema escuro"}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </Button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    me,
    error,
    itemIds,
    loading,
    refresh,
    startConnect,
    connecting,
    startSandbox,
    sandboxStatus,
  } = useFinance();
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    readCollapsed,
    () => false
  );
  const [query, setQuery] = useState("");

  function toggleCollapsed() {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "0" : "1");
    } catch {
      // sem armazenamento disponível: a preferência não persiste
    }
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/transacoes?q=${encodeURIComponent(q)}` : "/transacoes");
  }

  async function switchClient(clientId: string) {
    await fetch("/api/active-client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    window.location.reload();
  }

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex min-h-screen gap-4 p-3 pb-24 lg:p-4 lg:pb-4">
      {/* menu lateral */}
      <aside
        className={cn(
          "sticky top-4 hidden h-[calc(100vh-2rem)] shrink-0 flex-col rounded-3xl border bg-sidebar p-4 transition-[width] duration-200 lg:flex",
          collapsed ? "w-[76px]" : "w-64"
        )}
      >
        <Link
          href="/"
          className={cn(
            "mb-6 flex items-center gap-2.5 px-2 py-1",
            collapsed && "justify-center px-0"
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Leaf size={18} strokeWidth={2.2} />
          </span>
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight">{BRAND.name}</span>
          )}
        </Link>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                isActive(href)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon size={18} strokeWidth={1.9} />
              {!collapsed && label}
            </Link>
          ))}
        </nav>

        {!collapsed && (
          <div className="mb-3 rounded-2xl border bg-background/60 p-4">
            <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/25 text-foreground">
              <Sparkles size={15} />
            </span>
            <p className="text-sm font-semibold">Mais bancos, um só painel</p>
            <p className="mt-1 text-xs text-muted-foreground">
              O plano gratuito do Meu Pluggy aceita até 5 conexões
              {itemIds.length > 0 ? ` (${itemIds.length} em uso)` : ""}.
            </p>
            <Button
              size="sm"
              className="mt-3 w-full bg-foreground text-background hover:bg-foreground/90"
              onClick={startConnect}
              disabled={connecting}
            >
              {connecting ? "Abrindo…" : "Conectar banco"}
            </Button>
          </div>
        )}

        <button
          onClick={toggleCollapsed}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            collapsed && "justify-center px-0"
          )}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          {!collapsed && "Recolher menu"}
        </button>
      </aside>

      {/* conteúdo */}
      <div className="min-w-0 flex-1">
        <header className="mb-5 flex flex-wrap items-center gap-3">
          <form
            onSubmit={submitSearch}
            className="relative min-w-0 flex-1 basis-60 md:max-w-sm"
          >
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar transações…"
              className="h-10 w-full rounded-full border bg-card pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
              aria-label="Buscar transações"
            />
          </form>

          <div className="ml-auto flex items-center gap-2">
            {sandboxStatus !== null || itemIds.length === 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="hidden rounded-full border border-dashed text-muted-foreground sm:inline-flex"
                onClick={startSandbox}
                disabled={sandboxStatus !== null}
                title="Cria uma conexão com o banco fictício da Pluggy"
              >
                {sandboxStatus ?? "Modo teste"}
              </Button>
            ) : null}
            <ThemeToggle />
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full bg-card"
              onClick={refresh}
              disabled={loading || itemIds.length === 0}
              aria-label="Atualizar dados"
              title="Atualizar dados"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </Button>
            <div className="hidden items-center gap-2.5 rounded-full border bg-card py-1 pl-1 pr-4 md:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold uppercase text-primary-foreground">
                {(me?.client.name ?? "G").slice(0, 1)}
              </span>
              <span className="text-left leading-tight">
                {me?.isStaff && me.clients.length > 1 ? (
                  <select
                    value={me.client.id}
                    onChange={(e) => switchClient(e.target.value)}
                    aria-label="Trocar de cliente"
                    className="max-w-40 cursor-pointer bg-transparent text-sm font-semibold outline-none"
                  >
                    {me.clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="block max-w-40 truncate text-sm font-semibold">
                    {me?.client.name ?? "Conta pessoal"}
                  </span>
                )}
                <span className="block text-[11px] text-muted-foreground">
                  {me?.mode === "local"
                    ? "Modo local"
                    : me?.isStaff
                      ? "Equipe"
                      : me?.role === "viewer"
                        ? "Somente leitura"
                        : "Cliente"}
                </span>
              </span>
            </div>
            {me?.mode === "supabase" && (
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full bg-card"
                onClick={logout}
                aria-label="Sair"
                title="Sair"
              >
                <LogOut size={16} />
              </Button>
            )}
            <Button
              className="h-10 rounded-full px-4 font-semibold"
              onClick={startConnect}
              disabled={connecting}
            >
              <Plus size={16} />
              <span className="hidden sm:inline">
                {connecting ? "Abrindo…" : "Conectar banco"}
              </span>
            </Button>
          </div>
        </header>

        {error && (
          <div className="mb-5 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {children}
      </div>

      {/* navegação inferior no mobile */}
      <nav className="fixed inset-x-3 bottom-3 z-30 flex justify-around rounded-2xl border bg-card/95 p-1.5 shadow-lg backdrop-blur lg:hidden">
        {NAV.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium",
              isActive(href)
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground"
            )}
          >
            <Icon size={18} />
            <span className="w-full truncate text-center">
              {label.split(" ")[0]}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
