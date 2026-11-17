"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  HandCoins,
  LayoutDashboard,
  KeyRound,
  Leaf,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useFinance } from "@/components/finance-provider";
import { BRAND } from "@/lib/brand";
import { createClient } from "@/lib/supabase/browser";
import { SuiteBar } from "@/components/suite-bar";

import { NAV_GROUPS, type NavGroup, type NavItem } from "@/components/nav-data";

const BANK_PATHS = ["/bancos", "/transacoes", "/contas", "/investimentos", "/contas-fixas"];

const QUICK_CREATE = [
  { href: "/vendas/nova", label: "Nova venda ou orçamento", Icon: ShoppingCart },
  { href: "/clientes?novo=1", label: "Novo cliente", Icon: Users },
  { href: "/produtos?novo=1", label: "Novo produto ou serviço", Icon: Package },
  { href: "/compras/nova", label: "Nova compra", Icon: Truck },
  { href: "/receber?novo=1", label: "Nova conta a receber", Icon: HandCoins },
  { href: "/pagar?novo=1", label: "Nova conta a pagar", Icon: Receipt },
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

function NavLinks({
  groups,
  isActive,
  collapsed,
  onNavigate,
}: {
  groups: NavGroup[];
  isActive: (href: string) => boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto pr-0.5" aria-label="Menu principal">
      {groups.map((g, gi) => (
        <div key={g.label ?? "top"} className={cn(gi > 0 && "mt-3")}>
          {g.label && !collapsed && (
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink/45">{g.label}</p>
          )}
          {g.label && collapsed && gi > 0 && <div className="mx-3 mb-2 border-t border-ink/10" />}
          {g.items.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              title={collapsed ? label : undefined}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                isActive(href)
                  ? "bg-ink text-white shadow-[0_8px_18px_-10px_rgb(20_21_24/0.7)]"
                  : "text-ink/70 hover:bg-white/80 hover:text-ink"
              )}
            >
              <span className={isActive(href) ? "text-lime" : undefined}>
                <Icon size={18} strokeWidth={1.9} />
              </span>
              {!collapsed && label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, error, itemIds, loading, refresh, startConnect, connecting, startSandbox, sandboxStatus } = useFinance();
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

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
    router.push(q ? `/buscar?q=${encodeURIComponent(q)}` : "/buscar");
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
    if (me?.mode === "mvp") await fetch("/api/access/logout", { method: "POST" });
    else await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  // "Acessos" só aparece para a equipe, com o Supabase configurado
  const groups: NavGroup[] =
    me?.isStaff && me.mode === "supabase"
      ? NAV_GROUPS.map((g) =>
          g.label === "Sistema" ? { ...g, items: [...g.items, { href: "/acessos", label: "Acessos", Icon: KeyRound }] } : g
        )
      : NAV_GROUPS;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const onBankPage = BANK_PATHS.some((p) => isActive(p));

  const mobileMain: NavItem[] = [
    { href: "/", label: "Início", Icon: LayoutDashboard },
    { href: "/vendas", label: "Vendas", Icon: ShoppingCart },
    { href: "/clientes", label: "Clientes", Icon: Users },
    { href: "/receber", label: "Financeiro", Icon: HandCoins },
  ];

  return (
    <div className="min-h-screen">
    <SuiteBar />
    <div className="flex gap-4 p-3 pb-24 lg:p-4 lg:pb-4">
      {/* menu lateral */}
      <aside
        className={cn(
          "glass-sidebar sticky top-[76px] hidden h-[calc(100vh-92px)] shrink-0 flex-col rounded-[28px] p-4 text-ink transition-[width] duration-200 lg:flex print:hidden",
          collapsed ? "w-[76px]" : "w-64"
        )}
      >
        <Link href="/" className={cn("mb-5 flex items-center gap-2.5 px-2 py-1", collapsed && "justify-center px-0")}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-lime">
            <Leaf size={18} strokeWidth={2.2} />
          </span>
          {!collapsed && <span className="text-lg font-semibold tracking-tight">{BRAND.name}</span>}
        </Link>

        <NavLinks groups={groups} isActive={isActive} collapsed={collapsed} />

        <button
          onClick={toggleCollapsed}
          className={cn(
            "mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink/55 transition-colors hover:bg-white/80 hover:text-ink",
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
        <header className="mb-5 flex flex-wrap items-center gap-3 print:hidden">
          <form onSubmit={submitSearch} className="relative min-w-0 flex-1 basis-60 md:max-w-sm">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cliente, produto, venda…"
              className="h-10 w-full rounded-full border bg-card pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
              aria-label="Buscar no sistema"
            />
          </form>

          <div className="ml-auto flex items-center gap-2">
            {onBankPage && (sandboxStatus !== null || itemIds.length === 0) ? (
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
            {onBankPage && (
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full bg-card"
                onClick={refresh}
                disabled={loading || itemIds.length === 0}
                aria-label="Atualizar dados bancários"
                title="Atualizar dados bancários"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </Button>
            )}
            <div className="hidden items-center gap-2.5 rounded-full border bg-card py-1 pl-1 pr-4 md:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold uppercase text-primary-foreground">
                {(me?.client.name ?? "G").slice(0, 1)}
              </span>
              <span className="text-left leading-tight">
                {me?.isStaff && me.clients.length > 1 ? (
                  <select
                    value={me.client.id}
                    onChange={(e) => switchClient(e.target.value)}
                    aria-label="Trocar de empresa"
                    className="max-w-40 cursor-pointer bg-transparent text-sm font-semibold outline-none"
                  >
                    {me.clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="block max-w-40 truncate text-sm font-semibold">{me?.client.name ?? "Minha empresa"}</span>
                )}
                <span className="block text-[11px] text-muted-foreground">
                  {me?.mode === "local" ? "Modo local" : me?.isStaff ? "Equipe" : me?.role === "viewer" && me.mode === "supabase" ? "Somente leitura" : "Empresa"}
                </span>
              </span>
            </div>
            {(me?.mode === "supabase" || me?.mode === "mvp") && (
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-full bg-card" onClick={logout} aria-label="Sair" title="Sair">
                <LogOut size={16} />
              </Button>
            )}
            {onBankPage ? (
              <Button className="h-10 rounded-full px-4 font-semibold" onClick={startConnect} disabled={connecting}>
                <Plus size={16} />
                <span className="hidden sm:inline">{connecting ? "Abrindo…" : "Conectar banco"}</span>
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50">
                  <Plus size={16} />
                  <span className="hidden sm:inline">Novo</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>Criar agora</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {QUICK_CREATE.map(({ href, label, Icon }) => (
                    <DropdownMenuItem key={href} onClick={() => router.push(href)} className="gap-2.5 py-2">
                      <Icon size={16} />
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        {me?.demo && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-ink px-5 py-3 text-white print:hidden">
            <p className="text-sm"><span className="mr-2 rounded-full bg-lime px-2.5 py-0.5 text-xs font-semibold text-ink">DEMONSTRAÇÃO</span>Dados fictícios, só seus. Mexa à vontade: tudo some em 24 horas.</p>
            <Link href="/proposta" className="inline-flex h-9 items-center rounded-full bg-lime px-4 text-sm font-medium text-ink hover:bg-lime-deep">Quero o meu</Link>
          </div>
        )}

        {error && onBankPage && (
          <div className="mb-5 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        {children}
      </div>

      {/* navegação inferior no celular */}
      <nav
        className="fixed inset-x-3 bottom-3 z-30 flex justify-around rounded-2xl border bg-card/95 p-1.5 shadow-lg backdrop-blur lg:hidden print:hidden"
        aria-label="Atalhos"
      >
        {mobileMain.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium",
              isActive(href) ? "bg-ink text-white" : "text-muted-foreground"
            )}
          >
            <Icon size={18} />
            <span className="w-full truncate text-center">{label}</span>
          </Link>
        ))}
        <button
          onClick={() => setMenuOpen(true)}
          className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium text-muted-foreground"
          aria-label="Abrir menu completo"
        >
          <Menu size={18} />
          <span>Menu</span>
        </button>
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="glass-sidebar w-[86%] gap-0 rounded-none border-0 p-0 text-ink data-[side=left]:sm:max-w-xs">
          <SheetHeader className="border-b border-ink/10 p-4">
            <SheetTitle className="flex items-center gap-2.5 text-lg font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-lime">
                <Leaf size={16} />
              </span>
              {BRAND.name}
            </SheetTitle>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col p-3">
            <NavLinks groups={groups} isActive={isActive} onNavigate={() => setMenuOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
    </div>
  );
}
