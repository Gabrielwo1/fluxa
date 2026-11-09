"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, Pencil, Plus, Printer, ShoppingCart, Trash2, Undo2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { call, qs, useApi } from "@/lib/erp/client";
import type { Account, Sale, Title } from "@/lib/erp/types";
import { fmtDate, money, monthStartIso, qtyFmt, todayIso, addDaysIso } from "@/lib/erp/format";
import { Chips, ConfirmDialog, EmptyState, ErrorNote, FormDialog, Kpi, LoadingRows, PageHeader, SearchBox, Tag, useDebounced } from "@/components/erp/ui";
import { DataTable, type Column } from "@/components/erp/data-table";
import { PaymentFields, defaultPayment, toConfirmPayload, type PaymentState } from "@/components/erp/payment-fields";
import { PayDialog } from "@/components/erp/pay-dialog";
import { SaleStatusTag, TitleStatusTag } from "@/components/erp/status";
import { ErpGate } from "@/components/erp/gate";

type StatusFilter = "all" | "quote" | "confirmed" | "canceled";
type Period = "month" | "prev" | "90" | "all";

function periodRange(p: Period): { from?: string; to?: string } {
  const today = todayIso();
  if (p === "month") return { from: monthStartIso(today), to: today };
  if (p === "prev") {
    const last = addDaysIso(monthStartIso(today), -1);
    return { from: monthStartIso(last), to: last };
  }
  if (p === "90") return { from: addDaysIso(today, -90), to: today };
  return {};
}

const paymentTag = (s: Sale) => {
  if (s.status !== "confirmed") return null;
  if ((s.overdue ?? 0) > 0) return <Tag tone="bad">Atrasado</Tag>;
  if ((s.open ?? 0) > 0) return <Tag tone="warn">{(s.received ?? 0) > 0 ? "Parcial" : "A receber"}</Tag>;
  return <Tag tone="good">Recebido</Tag>;
};

export function SalesListPage() {
  return <ErpGate>{() => <List />}</ErpGate>;
}

function List() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [period, setPeriod] = useState<Period>("month");
  const debounced = useDebounced(q);
  const range = periodRange(period);
  const { data, error, loading, reload } = useApi<{ sales: Sale[] }>(`/api/erp/sales${qs({ q: debounced, status, ...range })}`);
  const sales = useMemo(() => data?.sales ?? [], [data]);
  const confirmed = sales.filter((s) => s.status === "confirmed");
  const revenue = confirmed.reduce((s, x) => s + x.total, 0);
  const quotes = sales.filter((s) => s.status === "quote");

  const columns: Column<Sale>[] = [
    { key: "n", header: "Nº", cell: (s) => <span className="font-semibold">#{s.number}</span> },
    { key: "date", header: "Data", cell: (s) => fmtDate(s.issue_date) },
    { key: "customer", header: "Cliente", cell: (s) => s.customer_name ?? <span className="text-muted-foreground">Balcão</span> },
    { key: "items", header: "Itens", align: "right", cell: (s) => s.items_count },
    { key: "total", header: "Total", align: "right", cell: (s) => <span className="font-semibold">{money(s.total)}</span> },
    { key: "pay", header: "Pagamento", cell: (s) => paymentTag(s) ?? "—" },
    { key: "status", header: "Situação", cell: (s) => <SaleStatusTag status={s.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Vendas e orçamentos"
        description="Tudo o que você vendeu ou ainda está negociando."
        help={
          <>
            <p>Uma venda passa por três etapas: <strong>orçamento</strong> (negociando), <strong>confirmada</strong> (fechou) e, se precisar, <strong>cancelada</strong>.</p>
            <p>Ao confirmar, o estoque baixa e as contas a receber são criadas. Você acompanha tudo em Financeiro.</p>
          </>
        }
        actions={
          <Button className="rounded-full font-semibold" render={<Link href="/vendas/nova" />}>
            <Plus size={16} /> Nova venda
          </Button>
        }
      />
      {error && <ErrorNote message={error} onRetry={reload} />}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Faturamento no período" value={money(revenue)} sub={`${confirmed.length} venda(s) confirmada(s)`} />
        <Kpi label="Ticket médio" value={money(confirmed.length ? revenue / confirmed.length : 0)} hint="Valor médio de cada venda." />
        <Kpi label="Orçamentos em aberto" value={String(quotes.length)} sub={money(quotes.reduce((s, x) => s + x.total, 0))} />
        <Kpi label="A receber das vendas" value={money(confirmed.reduce((s, x) => s + (x.open ?? 0), 0))} tone={confirmed.some((x) => (x.overdue ?? 0) > 0) ? "warn" : undefined} />
      </div>

      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchBox value={q} onChange={setQ} placeholder="Buscar por cliente ou número…" className="w-full sm:max-w-xs sm:flex-1" />
          <Chips label="Período" value={period} onChange={setPeriod} options={[{ value: "month", label: "Este mês" }, { value: "prev", label: "Mês passado" }, { value: "90", label: "90 dias" }, { value: "all", label: "Tudo" }]} />
        </div>
        <div className="mb-4">
          <Chips label="Situação" value={status} onChange={setStatus} options={[{ value: "all", label: "Todas" }, { value: "quote", label: "Orçamentos" }, { value: "confirmed", label: "Confirmadas" }, { value: "canceled", label: "Canceladas" }]} />
        </div>
        {loading && !data ? (
          <LoadingRows />
        ) : sales.length === 0 ? (
          q || status !== "all" || period !== "all" ? (
            <EmptyState icon={ShoppingCart} title="Nenhuma venda neste filtro">Mude o período ou a situação para ver mais.</EmptyState>
          ) : (
            <EmptyState icon={ShoppingCart} title="Registre a primeira venda" action={<Button className="rounded-full font-semibold" render={<Link href="/vendas/nova" />}><Plus size={16} /> Nova venda</Button>}>
              Escolha o cliente, adicione os produtos e confirme. O estoque e o financeiro se atualizam sozinhos.
            </EmptyState>
          )
        ) : (
          <SaleRows sales={sales} columns={columns} />
        )}
      </Panel>
    </>
  );
}

function SaleRows({ sales, columns }: { sales: Sale[]; columns: Column<Sale>[] }) {
  const router = useRouter();
  return (
    <DataTable
      rows={sales}
      rowKey={(s) => s.id}
      columns={columns}
      onRowClick={(s) => router.push(`/vendas/${s.id}`)}
      mobileCard={(s) => (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">#{s.number} · {s.customer_name ?? "Balcão"}</p>
            <p className="text-xs text-muted-foreground">{fmtDate(s.issue_date)} · {s.items_count} item(ns)</p>
            <div className="mt-1.5 flex gap-1.5"><SaleStatusTag status={s.status} />{paymentTag(s)}</div>
          </div>
          <span className="font-semibold tabular-nums">{money(s.total)}</span>
        </div>
      )}
    />
  );
}

// ---------- detalhe da venda ----------

export function SaleDetailPage({ id }: { id: string }) {
  return <ErpGate>{(st) => <Detail id={id} canWrite={st.canWrite} />}</ErpGate>;
}

function Detail({ id, canWrite }: { id: string; canWrite: boolean }) {
  const router = useRouter();
  const { data: sale, error, reload } = useApi<Sale>(`/api/erp/sales/${id}`);
  const accounts = useApi<{ accounts: Account[] }>("/api/erp/accounts");
  const [confirming, setConfirming] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [paying, setPaying] = useState<Title | null>(null);
  const [pay, setPay] = useState<PaymentState>(() => defaultPayment(todayIso()));
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (error) return <ErrorNote message={error} />;
  if (!sale) return <LoadingRows rows={6} />;

  const cost = (sale.items ?? []).reduce((s, i) => s + (i.unit_cost ?? 0) * i.qty, 0);
  const profit = sale.total - cost;

  async function confirm() {
    if (!sale) return;
    setFormError(null);
    if (pay.mode === "later" && !sale.customer_id && sale.total > 0) return setFormError("Para vender a prazo, o orçamento precisa ter um cliente. Edite e escolha o cliente.");
    setBusy(true);
    try {
      await call("POST", `/api/erp/sales/${id}/confirm`, toConfirmPayload(pay, sale.issue_date));
      toast.success(`Venda #${sale.number} confirmada.`);
      setConfirming(false);
      reload();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <Link href="/vendas" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground print:hidden">
        <ArrowLeft size={15} /> Vendas
      </Link>
      <PageHeader
        title={`${sale.status === "quote" ? "Orçamento" : "Venda"} #${sale.number}`}
        description={`${fmtDate(sale.issue_date)}${sale.customer_name ? ` · ${sale.customer_name}` : " · Venda de balcão"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <SaleStatusTag status={sale.status} />
            <Button variant="outline" className="rounded-full" onClick={() => window.print()}><Printer size={15} /> Imprimir</Button>
            <Button variant="outline" className="rounded-full" render={<Link href={`/vendas/nova?duplicar=${sale.id}`} />}><Copy size={15} /> Duplicar</Button>
            {canWrite && sale.status === "quote" && (
              <>
                <Button variant="outline" className="rounded-full" render={<Link href={`/vendas/${sale.id}/editar`} />}><Pencil size={15} /> Editar</Button>
                <Button className="rounded-full font-semibold" onClick={() => { setPay(defaultPayment(sale.issue_date)); setFormError(null); setConfirming(true); }}><Check size={15} /> Confirmar venda</Button>
              </>
            )}
            {canWrite && sale.status === "confirmed" && (
              <Button variant="outline" className="rounded-full text-destructive" onClick={() => setCanceling(true)}><XCircle size={15} /> Cancelar venda</Button>
            )}
            {canWrite && sale.status === "quote" && (
              <Button variant="ghost" className="rounded-full text-destructive" onClick={() => setDeleting(true)}><Trash2 size={15} /></Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid grid-cols-1 min-w-0 gap-4">
          <Panel>
            <h2 className="mb-3 text-base font-semibold">Itens</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2 text-left font-medium">Item</th><th className="px-2 py-2 text-right font-medium">Qtd.</th><th className="px-2 py-2 text-right font-medium">Preço</th><th className="px-2 py-2 text-right font-medium">Desc.</th><th className="py-2 text-right font-medium">Total</th></tr></thead>
                <tbody className="divide-y">
                  {(sale.items ?? []).map((i, idx) => (
                    <tr key={i.id ?? idx}>
                      <td className="py-2.5 pr-2 font-medium">{i.description}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{qtyFmt(i.qty)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{money(i.unit_price)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{i.discount ? money(i.discount) : "—"}</td>
                      <td className="py-2.5 text-right font-semibold tabular-nums">{money(i.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{money(sale.subtotal)}</dd></div>
              {sale.discount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Desconto</dt><dd className="tabular-nums">− {money(sale.discount)}</dd></div>}
              <div className="flex justify-between border-t pt-2 text-lg font-bold"><dt>Total</dt><dd className="tabular-nums">{money(sale.total)}</dd></div>
            </dl>
            {sale.notes && <p className="mt-4 rounded-xl bg-muted px-3 py-2 text-sm"><span className="font-medium">Observações: </span>{sale.notes}</p>}
          </Panel>

          {sale.status !== "quote" && (
            <Panel>
              <h2 className="mb-3 text-base font-semibold">Pagamento</h2>
              {(sale.titles ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma cobrança gerada.</p>
              ) : (
                <ul className="divide-y">
                  {(sale.titles ?? []).map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t.installment_total ? `Parcela ${t.installment_no}/${t.installment_total}` : "Pagamento único"} · vence {fmtDate(t.due_date)}</p>
                        <p className="text-xs text-muted-foreground">{t.status === "paid" ? `Recebido em ${fmtDate(t.paid_at)}${t.account_name ? ` · ${t.account_name}` : ""}` : t.status === "canceled" ? "Cancelada" : t.overdue ? `Atrasada há ${t.days_late} dias` : "Aguardando"}</p>
                      </div>
                      <div className="flex items-center gap-2 print:hidden">
                        <span className="text-sm font-semibold tabular-nums">{money(t.amount)}</span>
                        {t.status === "canceled" ? <Tag tone="bad">Cancelada</Tag> : <TitleStatusTag title={t} />}
                        {canWrite && t.status === "open" && sale.status === "confirmed" && <Button size="sm" className="rounded-full" onClick={() => setPaying(t)}>Receber</Button>}
                        {canWrite && t.status === "paid" && sale.status === "confirmed" && (
                          <Button size="sm" variant="ghost" className="rounded-full" title="Desfazer recebimento" onClick={() => act(() => call("POST", `/api/erp/titles/${t.id}/unpay`), "Recebimento desfeito.")}><Undo2 size={14} /></Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>

        <div className="grid grid-cols-1 min-w-0 gap-4">
          <Panel>
            <h2 className="mb-3 text-base font-semibold">Resumo</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Cliente</dt><dd className="text-right font-medium">{sale.customer_id ? <Link className="underline-offset-2 hover:underline" href="/clientes">{sale.customer_name}</Link> : "Balcão"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Forma de pagamento</dt><dd className="text-right font-medium">{sale.payment_method || "—"}</dd></div>
              {sale.status === "confirmed" && (
                <>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Já recebido</dt><dd className="font-medium tabular-nums">{money(sale.received ?? 0)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Falta receber</dt><dd className="font-medium tabular-nums">{money(sale.open ?? 0)}</dd></div>
                  {cost > 0 && (
                    <div className="flex justify-between border-t pt-2"><dt className="text-muted-foreground" title="Total menos o custo dos produtos">Lucro bruto</dt><dd className={`font-semibold tabular-nums ${profit >= 0 ? "text-good" : "text-bad"}`}>{money(profit)}</dd></div>
                  )}
                </>
              )}
            </dl>
            {sale.status === "quote" && <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">Este orçamento ainda não mexeu em estoque nem em financeiro. Ao confirmar, as duas coisas acontecem.</p>}
          </Panel>
        </div>
      </div>

      <FormDialog open={confirming} onOpenChange={setConfirming} title="Confirmar venda" description={`Total ${money(sale.total)}. Defina como será o pagamento.`} submitLabel="Confirmar venda" onSubmit={confirm} busy={busy} error={formError}>
        <PaymentFields value={pay} onChange={setPay} total={sale.total} direction="in" accounts={(accounts.data?.accounts ?? []).filter((a) => a.active)} issueDate={sale.issue_date} />
      </FormDialog>
      <ConfirmDialog open={canceling} onOpenChange={setCanceling} title={`Cancelar a venda #${sale.number}?`} danger confirmLabel="Cancelar venda" onConfirm={async () => { await act(() => call("POST", `/api/erp/sales/${id}/cancel`), "Venda cancelada."); setCanceling(false); }}>
        O estoque volta e as parcelas em aberto são canceladas. Se alguma parcela já foi recebida, desfaça o recebimento antes.
      </ConfirmDialog>
      <ConfirmDialog open={deleting} onOpenChange={setDeleting} title="Excluir este orçamento?" danger confirmLabel="Excluir" onConfirm={async () => { try { await call("DELETE", `/api/erp/sales/${id}`); toast.success("Orçamento excluído."); router.push("/vendas"); } catch (e) { toast.error((e as Error).message); setDeleting(false); } }}>
        Não dá para desfazer.
      </ConfirmDialog>
      <PayDialog title={paying} onOpenChange={(o) => !o && setPaying(null)} onDone={reload} />
    </>
  );
}
