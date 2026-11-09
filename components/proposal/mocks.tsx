import { AlarmClock, Boxes, Check, HandCoins, Package, Receipt, ShoppingCart, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

// Telinhas ilustrativas dos módulos, desenhadas com o mesmo visual do sistema.
// Os nomes e valores são fictícios.

function Frame({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("w-full overflow-hidden rounded-3xl border bg-card shadow-[0_8px_30px_rgb(0_0_0/0.06)]", className)} aria-hidden>
      <div className="flex items-center gap-1.5 border-b bg-muted/60 px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-bad/60" />
        <span className="h-2 w-2 rounded-full bg-[var(--c-fixed)]/60" />
        <span className="h-2 w-2 rounded-full bg-good/60" />
        <span className="ml-2 text-xs font-medium text-muted-foreground">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

const Tag = ({ tone, children }: { tone: "good" | "bad" | "warn" | "info"; children: React.ReactNode }) => (
  <span
    className={cn(
      "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
      tone === "good" && "bg-good/15 text-good",
      tone === "bad" && "bg-bad/15 text-bad",
      tone === "warn" && "bg-[var(--c-fixed)]/15 text-[var(--c-fixed)]",
      tone === "info" && "bg-[var(--c-total)]/15 text-[var(--c-total)]"
    )}
  >
    {children}
  </span>
);

function Row({ icon, title, sub, right, tag }: { icon?: React.ReactNode; title: string; sub?: string; right?: string; tag?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      {icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {right && <span className="text-sm font-semibold tabular-nums">{right}</span>}
        {tag}
      </div>
    </div>
  );
}

const Kpi = ({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) => (
  <div className="rounded-2xl border bg-background p-3">
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className={cn("mt-0.5 text-lg font-bold tabular-nums", tone === "good" && "text-good", tone === "bad" && "text-bad")}>{value}</p>
  </div>
);

export function MockDashboard() {
  const bars = [38, 52, 44, 66, 58, 82];
  return (
    <Frame title="Início">
      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Vendas do mês" value="R$ 28.400" />
        <Kpi label="Resultado" value="R$ 9.120" tone="good" />
        <Kpi label="A receber" value="R$ 12.750" />
        <Kpi label="Em atraso" value="R$ 1.690" tone="bad" />
      </div>
      <div className="mt-3 flex h-20 items-end gap-2 rounded-2xl border bg-background p-3">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 rounded-t-md bg-[var(--c-total)]" style={{ height: `${h}%`, opacity: i === bars.length - 1 ? 1 : 0.55 }} />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-[var(--c-fixed)]/10 px-3 py-2 text-xs">
        <AlarmClock size={14} className="text-[var(--c-fixed)]" /> <span className="font-medium">Cobrar Mercado Boa Compra: 3 dias de atraso</span>
      </div>
    </Frame>
  );
}

export function MockCustomers() {
  return (
    <Frame title="Clientes">
      <Row icon={<Users size={15} />} title="Auto Center Rota 66" sub="(11) 91230-4567 · já comprou R$ 4.091" tag={<Tag tone="good">Ativo</Tag>} />
      <Row icon={<Users size={15} />} title="Escola Aprender Mais" sub="Contrato mensal · última compra há 4 dias" tag={<Tag tone="good">Ativo</Tag>} />
      <Row icon={<Users size={15} />} title="Studio Bella Forma" sub="Pediu orçamento de instalação" tag={<Tag tone="info">Lead</Tag>} />
      <div className="mt-2 flex gap-2">
        <span className="rounded-full border px-3 py-1 text-xs">WhatsApp</span>
        <span className="rounded-full border px-3 py-1 text-xs">Nova venda</span>
        <span className="rounded-full border px-3 py-1 text-xs">Histórico</span>
      </div>
    </Frame>
  );
}

export function MockSales() {
  return (
    <Frame title="Venda #128">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">Auto Center Rota 66</p>
        <Tag tone="good">Confirmada</Tag>
      </div>
      <div className="divide-y rounded-2xl border bg-background px-3 text-sm">
        <div className="flex justify-between py-2"><span>2 × Cadeira de escritório</span><span className="tabular-nums">R$ 918,00</span></div>
        <div className="flex justify-between py-2"><span>1 × Instalação de rede</span><span className="tabular-nums">R$ 350,00</span></div>
        <div className="flex justify-between py-2 font-bold"><span>Total</span><span className="tabular-nums">R$ 1.268,00</span></div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
        {["1/3 · 10/12", "2/3 · 09/01", "3/3 · 08/02"].map((t) => (
          <div key={t} className="rounded-xl border bg-background px-2 py-2"><p className="font-semibold">R$ 422,67</p><p className="text-muted-foreground">{t}</p></div>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Check size={13} className="text-good" /> Estoque baixou e as parcelas já estão em Contas a receber</p>
    </Frame>
  );
}

export function MockStock() {
  return (
    <Frame title="Estoque">
      <Row icon={<Package size={15} />} title="Caderno universitário" sub="Mínimo 20 un" right="76 un" tag={<Tag tone="good">OK</Tag>} />
      <Row icon={<Package size={15} />} title="Cartucho de tinta preto" sub="Mínimo 6 un" right="4 un" tag={<Tag tone="warn">Baixo</Tag>} />
      <Row icon={<Package size={15} />} title="Teclado ABNT2" sub="Mínimo 5 un" right="0 un" tag={<Tag tone="bad">Zerado</Tag>} />
      <div className="mt-2 flex items-center gap-2 rounded-2xl bg-primary/15 px-3 py-2 text-xs font-medium"><Boxes size={14} /> Valor em estoque: R$ 18.430</div>
    </Frame>
  );
}

export function MockFinance() {
  return (
    <Frame title="Contas a receber">
      <Row icon={<HandCoins size={15} />} title="Venda #121 · Mercado Boa Compra" sub="Parcela 1/2 · venceu 06/08" right="R$ 229,20" tag={<Tag tone="bad">Atrasado 96d</Tag>} />
      <Row icon={<HandCoins size={15} />} title="Mensalidade · Escola Aprender" sub="Vence 10/11" right="R$ 650,00" tag={<Tag tone="warn">Em aberto</Tag>} />
      <Row icon={<Receipt size={15} />} title="Aluguel da loja (a pagar)" sub="Vence 05/12" right="R$ 3.200,00" tag={<Tag tone="info">Recorrente</Tag>} />
    </Frame>
  );
}

export function MockCashflow() {
  const pts = [52, 50, 46, 55, 60, 54, 40, 34, 48, 62, 70, 66, 74, 82];
  const path = pts.map((p, i) => `${i ? "L" : "M"}${(i / (pts.length - 1)) * 100},${100 - p}`).join("");
  return (
    <Frame title="Fluxo de caixa · 60 dias">
      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Hoje" value="R$ 6,6 mil" />
        <Kpi label="Vai entrar" value="R$ 4,9 mil" tone="good" />
        <Kpi label="Vai sair" value="R$ 2,1 mil" />
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-3 h-28 w-full rounded-2xl border bg-background">
        <path d={`${path}L100,100L0,100Z`} fill="var(--c-income)" fillOpacity={0.15} />
        <path d={path} fill="none" stroke="var(--c-income)" strokeWidth={2.2} vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="mt-2 text-xs text-muted-foreground">O saldo previsto aparece dia a dia, e o sistema avisa antes de ficar negativo.</p>
    </Frame>
  );
}

export function MockReports() {
  const items = ["Vendas por mês, cliente ou produto", "Margem por produto", "Curva ABC", "Resultado do período (DRE)", "Contas em atraso", "Posição de estoque"];
  return (
    <Frame title="Relatórios">
      <ul className="space-y-1.5">
        {items.map((t, i) => (
          <li key={t} className="flex items-center justify-between rounded-2xl border bg-background px-3 py-2.5 text-sm">
            <span className="font-medium">{t}</span>
            <span className="text-xs text-muted-foreground">{i < 2 ? "CSV · PDF" : "→"}</span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

export function MockBank() {
  return (
    <Frame title="Banco conectado">
      <div className="rounded-2xl bg-foreground p-4 text-background">
        <p className="text-xs opacity-70">Saldo em conta</p>
        <p className="text-2xl font-bold tabular-nums">R$ 12.480,32</p>
        <p className="mt-1 text-[11px] opacity-70">Atualizado pelo Open Finance · somente leitura</p>
      </div>
      <Row icon={<Wallet size={15} />} title="Pix recebido · Marcos Oliveira" sub="Hoje" right="+ R$ 568,00" />
      <Row icon={<Wallet size={15} />} title="Compra no débito · Posto Central" sub="Ontem" right="− R$ 210,40" />
    </Frame>
  );
}

export function MockQuote() {
  return (
    <Frame title="Orçamento #129">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">Studio Bella Forma</p>
        <Tag tone="info">Orçamento</Tag>
      </div>
      <div className="rounded-2xl border bg-background p-3 text-sm">
        <div className="flex justify-between"><span>Instalação e configuração de rede</span><span className="tabular-nums">R$ 350,00</span></div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-full border py-2 text-center text-xs font-semibold">Salvar orçamento</div>
        <div className="rounded-full bg-primary py-2 text-center text-xs font-semibold text-primary-foreground">Confirmar venda</div>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><ShoppingCart size={13} /> Negociou? Um toque transforma em venda.</p>
    </Frame>
  );
}
