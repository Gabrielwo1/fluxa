"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, Check, FileX2, Landmark, Link2, Loader2, ReceiptText, SearchX } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui-kit";
import { Button, buttonVariants } from "@/components/ui/button";
import { useFinance } from "@/components/finance-provider";
import { call, qs, useApi } from "@/lib/erp/client";
import { addDaysIso, fmtDate, fmtDateShort, money, monthStartIso, todayIso } from "@/lib/erp/format";
import { reconcile, type BankCredit } from "@/lib/erp/reconcile";
import type { ConciliationData } from "@/lib/erp/services/conciliation";
import { Chips, EmptyState, ErrorNote, Kpi, LoadingRows, PageHeader, Tag } from "@/components/erp/ui";
import { ConciliationChart, type CrossingNote, type Fill } from "@/components/erp/conciliation-chart";
import { ErpGate } from "@/components/erp/gate";

type Range = "month" | "30" | "90";
type Tab = "baixa" | "orfas" | "semnota" | "notasemvenda" | "semextrato";

export function ConciliationPage() {
  return <ErpGate>{(st) => <Inner canWrite={st.canWrite} />}</ErpGate>;
}

function Inner({ canWrite }: { canWrite: boolean }) {
  const fin = useFinance();
  const [range, setRange] = useState<Range>("30");
  const [fill, setFill] = useState<Fill>("bank");
  const [tab, setTab] = useState<Tab>("baixa");
  const [notes, setNotes] = useState<CrossingNote[]>([]);
  const [settling, setSettling] = useState<string | null>(null);
  const onCrossings = useCallback((list: CrossingNote[]) => setNotes(list), []);

  const [to] = useState(todayIso);
  const from = range === "month" ? monthStartIso(to) : addDaysIso(to, range === "30" ? -29 : -89);
  const { data, error, loading, reload } = useApi<ConciliationData>(`/api/erp/conciliation${qs({ from, to })}`);
  const hasBank = fin.ready && fin.itemIds.length > 0;

  // entradas do Open Banking no período: só dinheiro que entrou em conta (nada de cartão, investimento ou transferência própria)
  const credits = useMemo<BankCredit[]>(() => {
    if (!hasBank) return [];
    const out: BankCredit[] = [];
    for (const t of fin.txs) {
      // o banco manda o instante em UTC (meia-noite de Brasília = 03:00Z): o dia vale no fuso do Brasil
      const date = new Date(t.date).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
      if (date < from || date > to) continue;
      const f = fin.flowOf(t);
      if (f.kind !== "income" || f.value <= 0) continue;
      out.push({ id: t.id, date, amount: f.value, description: t.description, account: fin.accountName.get(t.accountId) ?? "" });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [fin, hasBank, from, to]);

  const rec = useMemo(() => (data ? reconcile(credits, data.received, data.open) : null), [data, credits]);

  const series = useMemo(() => {
    if (!data) return null;
    const bankByDay = new Map<string, number>();
    for (const c of credits) bankByDay.set(c.date, (bankByDay.get(c.date) ?? 0) + c.amount);
    return {
      days: data.days.map((d) => d.date),
      sales: data.days.map((d) => d.sales),
      invoices: data.days.map((d) => d.invoices),
      bank: hasBank ? data.days.map((d) => Math.round((bankByDay.get(d.date) ?? 0) * 100) / 100) : null,
    };
  }, [data, credits, hasBank]);

  const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0);
  const totalSales = series ? sum(series.sales) : 0;
  const totalInvoices = series ? sum(series.invoices) : 0;
  const totalBank = series?.bank ? sum(series.bank) : 0;
  const matchedValue = rec ? sum(rec.matched.map((m) => m.credit.amount)) : 0;
  const suggestedValue = rec ? sum(rec.suggestions.map((s) => s.credit.amount)) : 0;
  const orphanValue = rec ? sum(rec.orphans.map((c) => c.amount)) : 0;

  async function settle(creditDate: string, amount: number, titleId: string) {
    setSettling(titleId);
    try {
      await call("POST", "/api/erp/conciliation/match", { title_id: titleId, paid_at: creditDate, amount });
      toast.success("Baixa registrada com a data do extrato.");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSettling(null);
    }
  }

  const counts: Record<Tab, number> = {
    baixa: rec?.suggestions.length ?? 0,
    orfas: rec?.orphans.length ?? 0,
    semnota: data?.sales_without_invoice.length ?? 0,
    notasemvenda: data?.invoices_without_sale.length ?? 0,
    semextrato: rec?.paidWithoutBank.length ?? 0,
  };

  return (
    <>
      <PageHeader
        title="Conciliação"
        description="Vendas, notas fiscais e dinheiro no banco, cruzados dia a dia."
        help={
          <>
            <p>Três linhas acumuladas: o que você <strong>vendeu</strong>, o que tem <strong>nota fiscal</strong> e o que <strong>entrou no banco</strong> (Open Banking).</p>
            <p>Onde uma linha passa por cima da outra aparece um nó. A <strong>faixa</strong> entre elas é o que ainda falta casar: vendido que não entrou, ou vendido sem nota.</p>
            <p>Embaixo, os <strong>fios soltos</strong>: entradas que batem com uma conta a receber (é só dar a baixa), entradas sem venda e vendas sem nota.</p>
          </>
        }
        actions={<Chips label="Período" value={range} onChange={setRange} options={[{ value: "month", label: "Este mês" }, { value: "30", label: "30 dias" }, { value: "90", label: "90 dias" }]} />}
      />

      {error && <ErrorNote message={error} onRetry={reload} />}
      {fin.ready && !hasBank && (
        <Panel className="mb-4 flex flex-wrap items-center justify-between gap-3 border-dashed">
          <p className="flex items-center gap-2 text-sm"><Landmark size={16} /> Sem banco conectado só aparecem dois fios (vendas e notas). Conecte o Open Banking para ver o terceiro.</p>
          <Link href="/bancos" className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}>Conectar banco</Link>
        </Panel>
      )}

      {(loading && !data) || !series ? (
        <LoadingRows />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Vendido" value={money(totalSales)} sub={`${sum(data!.days.map((d) => d.sales_count))} venda(s)`} />
            <Kpi label="Com nota fiscal" value={money(totalInvoices)} sub={totalSales > 0 ? `${Math.round((totalInvoices / totalSales) * 100)}% do vendido` : `${sum(data!.days.map((d) => d.invoices_count))} nota(s)`} tone={totalSales - totalInvoices > 0.5 ? "warn" : undefined} />
            <Kpi label="Entrou no banco" value={hasBank ? money(totalBank) : "—"} sub={hasBank ? `${credits.length} entrada(s)` : "Banco não conectado"} />
            <Kpi
              label={totalSales - totalBank >= 0 ? "Vendido que não entrou" : "Entrou além do vendido"}
              value={hasBank ? money(Math.abs(totalSales - totalBank)) : "—"}
              tone={hasBank && totalSales - totalBank > 0.5 ? "warn" : undefined}
              hint="Vendas do período menos entradas no banco. Pode ser prazo (a receber) ou recebimento de vendas de antes."
            />
          </div>

          <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <Panel>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold">Os três fios</h2>
                {hasBank && (
                  <Chips label="Faixa" value={fill} onChange={setFill} options={[{ value: "bank", label: "Vendas × banco" }, { value: "notes", label: "Vendas × notas" }]} />
                )}
              </div>
              <ConciliationChart days={series.days} sales={series.sales} invoices={series.invoices} bank={series.bank} fill={hasBank ? fill : "notes"} onCrossings={onCrossings} />
              <Legend fill={hasBank ? fill : "notes"} />
            </Panel>

            <div className="grid content-start gap-4">
              <Panel>
                <h2 className="mb-3 text-base font-semibold">Onde as linhas se cruzam</h2>
                {notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum cruzamento no período: as linhas andaram sem trocar de lado.</p>
                ) : (
                  <ol className="space-y-2.5 border-l pl-4 text-sm">
                    {notes.map((c, i) => (
                      <li key={i} className="relative">
                        <span className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-foreground bg-background" />
                        <p className="font-medium">{c.up} passou {c.down}</p>
                        <p className="text-xs text-muted-foreground">{fmtDateShort(c.date)} · em {money(c.value)}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </Panel>
              {hasBank && <RingPanel matched={matchedValue} suggested={suggestedValue} orphan={orphanValue} total={totalBank} />}
            </div>
          </div>

          <Panel>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Fios soltos</h2>
              <Chips
                label="Lista"
                value={tab}
                onChange={setTab}
                options={[
                  ...(hasBank ? [{ value: "baixa" as Tab, label: `Para dar baixa (${counts.baixa})` }, { value: "orfas" as Tab, label: `Entrou sem venda (${counts.orfas})` }] : []),
                  { value: "semnota", label: `Vendido sem nota (${counts.semnota})` },
                  { value: "notasemvenda", label: `Nota sem venda (${counts.notasemvenda})` },
                  ...(hasBank ? [{ value: "semextrato" as Tab, label: `Baixa sem extrato (${counts.semextrato})` }] : []),
                ]}
              />
            </div>
            {tab === "baixa" && hasBank && (
              rec!.suggestions.length === 0 ? (
                <EmptyState icon={Check} title="Nada esperando baixa">Nenhuma entrada do banco bate com uma conta a receber em aberto.</EmptyState>
              ) : (
                <ul className="divide-y">
                  {rec!.suggestions.map((s) => (
                    <li key={s.credit.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{s.credit.description}</p>
                          <p className="text-xs text-muted-foreground">Banco · {fmtDate(s.credit.date)}{s.credit.account ? ` · ${s.credit.account}` : ""}</p>
                        </div>
                        <ArrowRightLeft size={16} className="hidden text-muted-foreground sm:block" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{s.title.party ?? s.title.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.title.sale_number ? `Venda #${s.title.sale_number} · ` : ""}vence {fmtDate(s.title.due_date)}
                            {s.days === 0 ? " · no dia" : s.days > 0 ? ` · ${s.days} dia(s) depois` : ` · ${-s.days} dia(s) antes`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold tabular-nums">{money(s.credit.amount)}</span>
                        {canWrite && (
                          <Button size="sm" className="rounded-full" disabled={settling === s.title.id} onClick={() => settle(s.credit.date, s.credit.amount, s.title.id)}>
                            {settling === s.title.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Dar baixa
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )
            )}
            {tab === "orfas" && hasBank && (
              rec!.orphans.length === 0 ? (
                <EmptyState icon={Check} title="Toda entrada tem uma venda">Cada dinheiro que entrou no banco já está ligado a uma venda ou conta a receber.</EmptyState>
              ) : (
                <>
                  <p className="mb-2 text-xs text-muted-foreground">Dinheiro que entrou e não bate com nenhuma venda nem conta a receber. Pode ser venda ainda não lançada, aporte ou parcela de valor diferente.</p>
                  <ul className="divide-y">
                    {rec!.orphans.map((c) => (
                      <Row key={c.id} title={c.description} sub={`${fmtDate(c.date)}${c.account ? ` · ${c.account}` : ""}`} value={c.amount} action={canWrite ? <Link href="/vendas/nova" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "rounded-full")}><ReceiptText size={14} /> Lançar venda</Link> : null} />
                    ))}
                  </ul>
                </>
              )
            )}
            {tab === "semnota" && (
              data!.sales_without_invoice.length === 0 ? (
                <EmptyState icon={Check} title="Todas as vendas têm nota">Nenhuma venda confirmada do período está sem nota fiscal.</EmptyState>
              ) : (
                <ul className="divide-y">
                  {data!.sales_without_invoice.map((s) => (
                    <Row key={s.id} title={`Venda #${s.number}${s.customer ? ` · ${s.customer}` : ""}`} sub={fmtDate(s.issue_date)} value={s.total} action={<Link href={`/vendas/${s.id}`} className={cn(buttonVariants({ size: "sm", variant: "outline" }), "rounded-full")}><FileX2 size={14} /> Ver venda</Link>} />
                  ))}
                </ul>
              )
            )}
            {tab === "notasemvenda" && (
              data!.invoices_without_sale.length === 0 ? (
                <EmptyState icon={Check} title="Toda nota está ligada a uma venda">Nenhuma nota do período ficou solta.</EmptyState>
              ) : (
                <ul className="divide-y">
                  {data!.invoices_without_sale.map((i) => (
                    <Row key={i.id} title={`Nota ${i.number}${i.customer_name ? ` · ${i.customer_name}` : ""}`} sub={fmtDate(i.issue_date)} value={i.amount} action={<Link href="/notas-fiscais" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "rounded-full")}><Link2 size={14} /> Ligar à venda</Link>} />
                  ))}
                </ul>
              )
            )}
            {tab === "semextrato" && hasBank && (
              rec!.paidWithoutBank.length === 0 ? (
                <EmptyState icon={SearchX} title="Toda baixa tem extrato">Cada recebimento lançado no ERP tem a entrada correspondente no banco.</EmptyState>
              ) : (
                <>
                  <p className="mb-2 text-xs text-muted-foreground">Recebimentos marcados como pagos no ERP sem uma entrada igual no banco: dinheiro em espécie, conta não conectada ou baixa lançada com o valor errado.</p>
                  <ul className="divide-y">
                    {rec!.paidWithoutBank.map((t) => <Row key={t.id} title={t.description} sub={`Baixa em ${fmtDate(t.paid_at)}`} value={t.amount} action={<Tag tone="warn">Sem extrato</Tag>} />)}
                  </ul>
                </>
              )
            )}
          </Panel>
        </>
      )}
    </>
  );
}

function Row({ title, sub, value, action }: { title: string; sub: string; value: number; action: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-semibold tabular-nums">{money(value)}</span>
        {action}
      </div>
    </li>
  );
}

function Legend({ fill }: { fill: Fill }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-foreground bg-background" /> Cruzamento</li>
      {fill === "bank" ? (
        <>
          <li className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-[var(--c-fixed)] opacity-40" /> Vendido, ainda não entrou</li>
          <li className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-[var(--c-income)] opacity-40" /> Entrou além do vendido</li>
        </>
      ) : (
        <>
          <li className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm" style={{ background: "repeating-linear-gradient(45deg, var(--c-bad) 0 2px, transparent 2px 5px)" }} /> Vendido sem nota</li>
          <li className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm" style={{ background: "repeating-linear-gradient(-45deg, var(--c-total) 0 2px, transparent 2px 5px)" }} /> Notas além do vendido</li>
        </>
      )}
      <li>Embaixo, dia a dia: barras azuis (vendas), amarelas (notas) e verdes (banco).</li>
    </ul>
  );
}

// Quanto do dinheiro que entrou no banco já está casado: verde (baixa feita), âmbar (falta dar a baixa), vermelho (sem venda).
function RingPanel({ matched, suggested, orphan, total }: { matched: number; suggested: number; orphan: number; total: number }) {
  const R = 46;
  const C = 2 * Math.PI * R;
  const parts = [
    { v: matched, color: "var(--c-income)", label: "Conciliado" },
    { v: suggested, color: "var(--c-fixed)", label: "Falta dar a baixa" },
    { v: orphan, color: "var(--c-bad)", label: "Sem venda" },
  ];
  let offset = 0;
  const pct = total > 0 ? Math.round((matched / total) * 100) : 0;
  return (
    <Panel>
      <h2 className="mb-3 text-base font-semibold">Dinheiro que entrou</h2>
      <div className="flex items-center gap-4">
        <svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label={`${pct}% do dinheiro que entrou no banco está conciliado`}>
          <circle cx="56" cy="56" r={R} fill="none" stroke="var(--muted)" strokeWidth="12" />
          {total > 0 && parts.map((p) => {
            const len = (p.v / total) * C;
            const el = <circle key={p.label} cx="56" cy="56" r={R} fill="none" stroke={p.color} strokeWidth="12" strokeDasharray={`${Math.max(len - 1.5, 0)} ${C}`} strokeDashoffset={-offset} transform="rotate(-90 56 56)" />;
            offset += len;
            return el;
          })}
          <text x="56" y="54" textAnchor="middle" className="fill-foreground text-[22px] font-bold">{pct}%</text>
          <text x="56" y="70" textAnchor="middle" className="fill-muted-foreground text-[10px]">conciliado</text>
        </svg>
        <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
          {parts.map((p) => (
            <li key={p.label} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.label}</span>
              <span className="font-medium tabular-nums">{money(p.v)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
