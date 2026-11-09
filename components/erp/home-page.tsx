"use client";

import { useState } from "react";
import Link from "next/link";
import { AlarmClock, ArrowRight, Boxes, Check, CircleDashed, FileText, HandCoins, Package, Plus, Receipt, Repeat, ShoppingCart, Sparkles, Truck, Users } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/components/finance-provider";
import { call, useApi } from "@/lib/erp/client";
import type { Dashboard } from "@/lib/erp/services/dashboard";
import { money, monthShort } from "@/lib/erp/format";
import { EmptyState, ErrorNote, Kpi, LoadingRows, PageHeader, Tag } from "@/components/erp/ui";
import { MonthBars, RankBars } from "@/components/erp/charts";
import { ErpGate } from "@/components/erp/gate";

export function HomePage() {
  return <ErpGate redirectIfOff="/bancos">{(st) => <Home canWrite={st.canWrite} company={st.company} />}</ErpGate>;
}

function greeting(hour: number) {
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

function Home({ canWrite, company }: { canWrite: boolean; company: string }) {
  const { data, error, reload } = useApi<Dashboard>("/api/erp/dashboard");
  const { itemIds } = useFinance();
  const [hour] = useState(() => new Date().getHours());
  const [busy, setBusy] = useState(false);

  async function demo(load: boolean) {
    setBusy(true);
    try {
      await call(load ? "POST" : "DELETE", "/api/erp/demo");
      toast.success(load ? "Dados de exemplo carregados. Explore à vontade!" : "Dados de exemplo apagados.");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return <LoadingRows rows={6} />;

  const d = data;
  const growth = d.sales.prev > 0 ? ((d.sales.total - d.sales.prev) / d.sales.prev) * 100 : null;
  const result = d.cash.received_month - d.cash.paid_month;
  const steps = [
    { done: d.setup.company, label: "Completar os dados da empresa", hint: "CNPJ, telefone e endereço", href: "/configuracoes" },
    { done: d.setup.customers > 0, label: "Cadastrar o primeiro cliente", hint: "Quem compra de você", href: "/clientes?novo=1" },
    { done: d.setup.products > 0, label: "Cadastrar o primeiro produto ou serviço", hint: "Com preço e estoque", href: "/produtos?novo=1" },
    { done: d.setup.sales > 0, label: "Registrar a primeira venda", hint: "O estoque e o financeiro se atualizam sozinhos", href: "/vendas/nova" },
    { done: d.setup.titles > 0, label: "Lançar uma conta a pagar", hint: "Aluguel, fornecedor, imposto", href: "/pagar?novo=1" },
    { done: itemIds.length > 0, label: "Conectar o banco (opcional)", hint: "Open Finance: extrato e saldo reais", href: "/bancos" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const todoCount = d.todo.overdue_titles.length + d.todo.due_today.length + d.todo.low_stock.length + d.todo.old_quotes.length + (d.todo.recurring_pending ? 1 : 0);
  const empty = d.setup.sales === 0 && d.setup.customers === 0 && d.setup.products === 0;

  return (
    <>
      <PageHeader
        title={`${greeting(hour)}, ${company}`}
        description="Um resumo do seu negócio hoje: o que entrou, o que falta receber e pagar, e o que precisa da sua atenção."
        help={
          <>
            <p>Este painel se atualiza sozinho conforme você registra vendas, compras e contas.</p>
            <p>Cada número é clicável quando leva a uma lista. Em <strong>Ajuda</strong> você vê como as partes do sistema se conectam.</p>
          </>
        }
        actions={canWrite ? <Button className="rounded-full font-semibold" render={<Link href="/vendas/nova" />}><Plus size={16} /> Nova venda</Button> : undefined}
      />

      {d.setup.has_demo && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--c-total)]/40 bg-[var(--c-total)]/10 p-4">
          <div className="flex items-start gap-3"><Sparkles size={18} className="mt-0.5 shrink-0" /><div><p className="text-sm font-semibold">Você está vendo dados de exemplo</p><p className="text-xs text-muted-foreground">Clientes, vendas e contas fictícios para você explorar. Quando quiser começar de verdade, apague-os; o que você cadastrou não é apagado.</p></div></div>
          {canWrite && <Button variant="outline" className="rounded-full" disabled={busy} onClick={() => demo(false)}>Apagar dados de exemplo</Button>}
        </div>
      )}

      {doneCount < steps.length && !d.setup.has_demo && (
        <Panel className="mb-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-base font-semibold">Primeiros passos</h2><p className="text-xs text-muted-foreground">{doneCount} de {steps.length} concluídos. Siga a ordem e em poucos minutos o sistema está rodando.</p></div>
            <div className="h-2 w-40 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
          </div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {steps.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors hover:border-primary/60 ${s.done ? "opacity-60" : ""}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${s.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{s.done ? <Check size={16} /> : <CircleDashed size={16} />}</span>
                  <span className="min-w-0"><span className={`block text-sm font-medium ${s.done ? "line-through" : ""}`}>{s.label}</span><span className="block text-xs text-muted-foreground">{s.hint}</span></span>
                </Link>
              </li>
            ))}
          </ul>
          {empty && canWrite && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3">
              <p className="text-sm text-muted-foreground">Prefere ver o sistema funcionando antes? Carregue uma empresa de exemplo e apague quando quiser.</p>
              <Button variant="outline" className="rounded-full" disabled={busy} onClick={() => demo(true)}><Sparkles size={15} /> Carregar dados de exemplo</Button>
            </div>
          )}
        </Panel>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <Kpi label="Vendas do mês" value={money(d.sales.total)} sub={growth === null ? `${d.sales.count} venda(s)` : `${growth >= 0 ? "▲" : "▼"} ${Math.abs(growth).toFixed(0)}% vs mês passado`} tone={growth !== null && growth < 0 ? "bad" : undefined} />
        <Link href="/receber"><Kpi label="A receber" value={money(d.receivable.open)} sub={d.receivable.overdue > 0 ? `${money(d.receivable.overdue)} em atraso` : "Nada atrasado"} tone={d.receivable.overdue > 0 ? "warn" : undefined} /></Link>
        <Link href="/pagar"><Kpi label="A pagar" value={money(d.payable.open)} sub={d.payable.overdue > 0 ? `${money(d.payable.overdue)} em atraso` : d.payable.next7 > 0 ? `${money(d.payable.next7)} nos próximos 7 dias` : "Em dia"} tone={d.payable.overdue > 0 ? "bad" : undefined} /></Link>
        <Link href="/caixas"><Kpi label="Dinheiro em caixa" value={money(d.cash.balance)} tone={d.cash.balance < 0 ? "bad" : undefined} sub="Soma das contas ativas" /></Link>
        <Kpi label="Resultado do mês" value={money(result)} tone={result < 0 ? "bad" : "good"} sub={`${money(d.cash.received_month)} entrou · ${money(d.cash.paid_month)} saiu`} hint="Dinheiro que entrou menos o que saiu neste mês (regime de caixa)." />
        <Link href="/produtos"><Kpi label="Estoque baixo" value={String(d.stock.low)} tone={d.stock.low ? "warn" : undefined} sub={d.stock.low ? "Itens para repor" : `Estoque: ${money(d.stock.value)}`} /></Link>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel>
          <h2 className="mb-1 text-base font-semibold">Vendas, recebimentos e pagamentos</h2>
          <p className="mb-3 text-xs text-muted-foreground">Últimos 6 meses. “Vendas” é o que você fechou; “Recebido” e “Pago” é o dinheiro que de fato entrou e saiu.</p>
          <MonthBars
            data={d.series}
            series={[
              { key: "sales", label: "Vendas", color: "var(--c-total)" },
              { key: "received", label: "Recebido", color: "var(--c-income)" },
              { key: "paid", label: "Pago", color: "var(--c-fixed)" },
            ]}
          />
          <p className="mt-2 text-xs text-muted-foreground">{d.series.length > 0 ? `De ${monthShort(d.series[0].month)} a ${monthShort(d.series[d.series.length - 1].month)}.` : ""}</p>
        </Panel>

        <Panel>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">O que fazer hoje</h2>{todoCount > 0 && <Tag tone="warn">{todoCount}</Tag>}</div>
          {todoCount === 0 ? (
            <EmptyState icon={Check} title="Tudo em dia">Sem contas atrasadas, vencimentos para hoje ou estoque em falta.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {d.todo.overdue_titles.map((t) => (
                <TodoRow key={t.id} href={t.direction === "in" ? "/receber" : "/pagar"} icon={<AlarmClock size={16} />} tone="bad" title={`${t.direction === "in" ? "Cobrar" : "Pagar"}: ${t.party ?? t.description}`} sub={`${money(t.amount)} · atrasado há ${t.days_late} dia(s)`} />
              ))}
              {d.todo.due_today.map((t) => (
                <TodoRow key={t.id} href={t.direction === "in" ? "/receber" : "/pagar"} icon={t.direction === "in" ? <HandCoins size={16} /> : <Receipt size={16} />} tone="warn" title={`Vence hoje: ${t.description}`} sub={`${money(t.amount)}${t.party ? ` · ${t.party}` : ""}`} />
              ))}
              {d.todo.low_stock.map((p) => (
                <TodoRow key={p.id} href="/estoque" icon={<Boxes size={16} />} tone="warn" title={`Repor: ${p.name}`} sub={`Tem ${p.stock} ${p.unit}, mínimo ${p.min_stock}`} />
              ))}
              {d.todo.old_quotes.map((s) => (
                <TodoRow key={s.id} href={`/vendas/${s.id}`} icon={<FileText size={16} />} tone="info" title={`Orçamento #${s.number} parado`} sub={`${s.customer ?? "Balcão"} · ${money(s.total)} · há ${s.days} dias`} />
              ))}
              {d.todo.recurring_pending > 0 && <TodoRow href="/recorrencias" icon={<Repeat size={16} />} tone="info" title="Lançar as recorrências do mês" sub={`${d.todo.recurring_pending} conta(s) fixa(s) ainda não lançada(s)`} />}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel>
          <h2 className="mb-3 text-base font-semibold">Melhores clientes <span className="text-xs font-normal text-muted-foreground">últimos 90 dias</span></h2>
          {d.top_customers.length === 0 ? <p className="text-sm text-muted-foreground">Aparecem aqui quando houver vendas com cliente.</p> : <RankBars rows={d.top_customers.map((c) => ({ label: c.name, value: c.total }))} />}
        </Panel>
        <Panel>
          <h2 className="mb-3 text-base font-semibold">Mais vendidos <span className="text-xs font-normal text-muted-foreground">últimos 90 dias</span></h2>
          {d.top_products.length === 0 ? <p className="text-sm text-muted-foreground">Aparecem aqui quando houver vendas.</p> : <RankBars color="var(--c-total)" rows={d.top_products.map((p) => ({ label: p.name, value: p.total }))} />}
        </Panel>
        <Panel>
          <h2 className="mb-3 text-base font-semibold">Em resumo</h2>
          <dl className="space-y-2.5 text-sm">
            <Row label="Ticket médio do mês" value={money(d.sales.ticket)} />
            <Row label="Orçamentos em aberto" value={`${d.sales.quotes_open} · ${money(d.sales.quotes_value)}`} href="/vendas" />
            <Row label="Clientes ativos" value={`${d.customers.total}${d.customers.new_month ? ` (+${d.customers.new_month} no mês)` : ""}`} href="/clientes" />
            <Row label="Leads em negociação" value={String(d.customers.leads)} href="/clientes" />
            <Row label="Vence nos próximos 7 dias" value={`${money(d.receivable.next7)} a receber · ${money(d.payable.next7)} a pagar`} />
            <Row label="Valor em estoque" value={money(d.stock.value)} href="/estoque" />
          </dl>
        </Panel>
      </div>

      {canWrite && (
        <Panel>
          <h2 className="mb-3 text-base font-semibold">Atalhos</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["/vendas/nova", "Nova venda", ShoppingCart],
              ["/clientes?novo=1", "Novo cliente", Users],
              ["/produtos?novo=1", "Novo produto", Package],
              ["/compras/nova", "Nova compra", Truck],
              ["/receber?novo=1", "Conta a receber", HandCoins],
              ["/pagar?novo=1", "Conta a pagar", Receipt],
            ].map(([href, label, Icon]) => {
              const I = Icon as typeof ShoppingCart;
              return (
                <Link key={href as string} href={href as string} className="flex flex-col items-center gap-2 rounded-2xl border p-4 text-center text-sm font-medium transition-colors hover:border-primary/60 hover:bg-primary/10">
                  <I size={20} />
                  {label as string}
                </Link>
              );
            })}
          </div>
        </Panel>
      )}
    </>
  );
}

function Row({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (<><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{value}</dd></>);
  return href ? <Link href={href} className="flex items-baseline justify-between gap-3 hover:underline">{body}</Link> : <div className="flex items-baseline justify-between gap-3">{body}</div>;
}

const TONE = { bad: "bg-bad/15 text-bad", warn: "bg-[var(--c-fixed)]/15 text-[var(--c-fixed)]", info: "bg-[var(--c-total)]/15 text-[var(--c-total)]" } as const;

function TodoRow({ href, icon, tone, title, sub }: { href: string; icon: React.ReactNode; tone: keyof typeof TONE; title: string; sub: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 rounded-2xl border p-3 transition-colors hover:border-primary/60">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TONE[tone]}`}>{icon}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{title}</span><span className="block truncate text-xs text-muted-foreground">{sub}</span></span>
        <ArrowRight size={14} className="shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

