"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  BarChart3,
  Boxes,
  Factory,
  HandCoins,
  Landmark,
  LayoutDashboard,
  KeyRound,
  Leaf,
  LifeBuoy,
  LineChart,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  Repeat,
  Search,
  Settings,
  ShoppingCart,
  Sun,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  ArrowLeftRight,
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

type NavItem = { href: string; label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }> };
type NavGroup = { label: string | null; items: NavItem[] };

// Menu do ERP: do dia a dia (vender, comprar, receber) até a análise. Os bancos conectados
// (Open Finance) ficam num grupo próprio, porque são uma fonte extra de dados, não o centro.
const NAV_GROUPS: NavGroup[] = [
  { label: null, items: [{ href: "/", label: "Início", Icon: LayoutDashboard }] },
  {
    label: "Vendas",
    items: [
      { href: "/vendas", label: "Vendas e orçamentos", Icon: ShoppingCart },
      { href: "/clientes", label: "Clientes", Icon: Users },
    ],
  },
  {
    label: "Compras e estoque",
    items: [
      { href: "/compras", label: "Compras", Icon: Truck },
      { href: "/fornecedores", label: "Fornecedores", Icon: Factory },
      { href: "/produtos", label: "Produtos e serviços", Icon: Package },
      { href: "/estoque", label: "Estoque", Icon: Boxes },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { href: "/receber", label: "A receber", Icon: HandCoins },
      { href: "/pagar", label: "A pagar", Icon: Receipt },
      { href: "/fluxo-de-caixa", label: "Fluxo de caixa", Icon: LineChart },
      { href: "/caixas", label: "Caixas e contas", Icon: Wallet },
      { href: "/recorrencias", label: "Recorrências", Icon: Repeat },
    ],
  },
  { label: "Análises", items: [{ href: "/relatorios", label: "Relatórios", Icon: BarChart3 }] },
  {
    label: "Bancos (Open Finance)",
    items: [
      { href: "/bancos", label: "Painel bancário", Icon: Landmark },
      { href: "/transacoes", label: "Transações", Icon: ArrowLeftRight },
      { href: "/contas", label: "Contas conectadas", Icon: Wallet },
      { href: "/investimentos", label: "Investimentos", Icon: TrendingUp },
      { href: "/contas-fixas", label: "Contas fixas e previsão", Icon: Receipt },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/configuracoes", label: "Configurações", Icon: Settings },
      { href: "/ajuda", label: "Ajuda e primeiros passos", Icon: LifeBuoy },
    ],
  },
];

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
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">{g.label}</p>
          )}
          {g.label && collapsed && gi > 0 && <div className="mx-3 mb-2 border-t" />}
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
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon size={18} strokeWidth={1.9} />
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
    <div className="flex min-h-screen gap-4 p-3 pb-24 lg:p-4 lg:pb-4">
      {/* menu lateral */}
      <aside
        className={cn(
          "sticky top-4 hidden h-[calc(100vh-2rem)] shrink-0 flex-col rounded-3xl border bg-sidebar p-4 transition-[width] duration-200 lg:flex print:hidden",
          collapsed ? "w-[76px]" : "w-64"
        )}
      >
        <Link href="/" className={cn("mb-5 flex items-center gap-2.5 px-2 py-1", collapsed && "justify-center px-0")}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Leaf size={18} strokeWidth={2.2} />
          </span>
          {!collapsed && <span className="text-lg font-bold tracking-tight">{BRAND.name}</span>}
        </Link>

        <NavLinks groups={groups} isActive={isActive} collapsed={collapsed} />

        <button
          onClick={toggleCollapsed}
          className={cn(
            "mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
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
            <ThemeToggle />
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
              isActive(href) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground"
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
        <SheetContent side="left" className="w-[86%] gap-0 p-0 data-[side=left]:sm:max-w-xs">
          <SheetHeader className="border-b p-4">
            <SheetTitle className="flex items-center gap-2.5 text-lg font-bold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
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
  );
}
