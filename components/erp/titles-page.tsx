"use client";

import { useMemo, useState } from "react";
import { HandCoins, MoreHorizontal, Plus, Receipt, Repeat } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { call, qs, useApi } from "@/lib/erp/client";
import type { Account, Category, Recurring, Title } from "@/lib/erp/types";
import { addDaysIso, fmtDate, money, monthStartIso, todayIso } from "@/lib/erp/format";
import { Chips, ConfirmDialog, DateField, EmptyState, ErrorNote, Field, FormSheet, Kpi, LoadingRows, MoneyInput, NumberField, PageHeader, SearchBox, SelectField, TextArea, TextInput, Toggle, useClearNew, useDebounced } from "@/components/erp/ui";
import { DataTable, type Column } from "@/components/erp/data-table";
import { PartyPicker } from "@/components/erp/entity-picker";
import { PayDialog } from "@/components/erp/pay-dialog";
import { TitleStatusTag } from "@/components/erp/status";
import { ErpGate } from "@/components/erp/gate";

type Summary = { open: number; open_count: number; overdue: number; overdue_count: number; today: number; next7: number; paid_month: number };
type StatusFilter = "open" | "overdue" | "paid" | "all";
type PeriodFilter = "all" | "week" | "month" | "next30";

const COPY = {
  in: {
    title: "Contas a receber",
    description: "Dinheiro que você ainda vai receber dos clientes: parcelas de vendas e cobranças avulsas.",
    help: (
      <>
        <p>Cada parcela de uma venda a prazo aparece aqui com a data em que o cliente deve pagar. Quando o dinheiro cair, clique em <strong>Receber</strong>.</p>
        <p>Lançamentos em <strong>vermelho</strong> já passaram do vencimento. Você também pode lançar cobranças que não vêm de venda (mensalidade, aluguel de equipamento…).</p>
      </>
    ),
    party: "Cliente",
    new: "Nova conta a receber",
    action: "Receber",
    done: "Recebido",
    paidKpi: "Recebido no mês",
    empty: "Nenhuma conta a receber",
    emptyText: "As parcelas das vendas a prazo aparecem aqui sozinhas. Você também pode lançar uma cobrança avulsa.",
    Icon: HandCoins,
    kind: "customer" as const,
  },
  out: {
    title: "Contas a pagar",
    description: "O que você precisa pagar: compras de fornecedores, aluguel, impostos e outras despesas.",
    help: (
      <>
        <p>Parcelas de compras e despesas do dia a dia ficam aqui, na ordem do vencimento. Quando pagar, clique em <strong>Pagar</strong> e escolha de qual caixa ou conta saiu.</p>
        <p>Para despesas que se repetem todo mês (aluguel, internet), use <strong>Recorrências</strong>.</p>
      </>
    ),
    party: "Fornecedor",
    new: "Nova conta a pagar",
    action: "Pagar",
    done: "Pago",
    paidKpi: "Pago no mês",
    empty: "Nenhuma conta a pagar",
    emptyText: "As parcelas das compras aparecem aqui sozinhas. Lance também aluguel, energia, impostos e outras despesas.",
    Icon: Receipt,
    kind: "supplier" as const,
  },
};

export function TitlesPage({ direction, novo = false }: { direction: "in" | "out"; novo?: boolean }) {
  return <ErpGate>{(st) => <Inner direction={direction} novo={novo} canWrite={st.canWrite} />}</ErpGate>;
}

function periodRange(p: PeriodFilter): { from?: string; to?: string } {
  const today = todayIso();
  if (p === "week") return { from: today, to: addDaysIso(today, 7) };
  if (p === "month") return { from: monthStartIso(today), to: addDaysIso(`${addDaysIso(monthStartIso(today), 31).slice(0, 7)}-01`, -1) };
  if (p === "next30") return { from: today, to: addDaysIso(today, 30) };
  return {};
}

function Inner({ direction, novo, canWrite }: { direction: "in" | "out"; novo: boolean; canWrite: boolean }) {
  const copy = COPY[direction];
  const clearNew = useClearNew(novo);
  const [status, setStatus] = useState<StatusFilter>("open");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [q, setQ] = useState("");
  const [formOpen, setFormOpen] = useState(novo);
  const [editing, setEditing] = useState<Title | null>(null);
  const [paying, setPaying] = useState<Title | null>(null);
  const [canceling, setCanceling] = useState<Title | null>(null);
  const debounced = useDebounced(q);
  const range = periodRange(period);
  const { data, error, loading, reload } = useApi<{ titles: Title[]; summary: Summary }>(`/api/erp/titles${qs({ direction, status, q: debounced, ...range })}`);
  const recurring = useApi<{ recurring: Recurring[] }>("/api/erp/recurring");
  const titles = useMemo(() => data?.titles ?? [], [data]);
  const s = data?.summary;
  const pending = (recurring.data?.recurring ?? []).filter((r) => r.active && r.direction === direction && !r.generated_this_month);

  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
      reload();
      recurring.reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const columns: Column<Title>[] = [
    { key: "due", header: "Vencimento", cell: (t) => <span className={t.overdue ? "font-semibold text-bad" : undefined}>{fmtDate(t.due_date)}</span> },
    {
      key: "desc",
      header: "Descrição",
      cell: (t) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{t.description}</p>
          <p className="truncate text-xs text-muted-foreground">{[t.party_name, t.category_name, t.installment_total ? `parcela ${t.installment_no}/${t.installment_total}` : null].filter(Boolean).join(" · ")}</p>
        </div>
      ),
    },
    { key: "amount", header: "Valor", align: "right", cell: (t) => <span className="font-semibold">{money(t.status === "paid" && t.paid_amount ? t.paid_amount : t.amount)}</span> },
    { key: "status", header: "Situação", cell: (t) => <TitleStatusTag title={t} /> },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (t) =>
        canWrite ? (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {t.status === "open" && <Button size="sm" className="rounded-full" onClick={() => setPaying(t)}>{copy.action}</Button>}
            <RowMenu t={t} onEdit={() => { setEditing(t); setFormOpen(true); }} onUnpay={() => act(() => call("POST", `/api/erp/titles/${t.id}/unpay`), "Baixa desfeita.")} onCancel={() => setCanceling(t)} />
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title={copy.title}
        description={copy.description}
        help={copy.help}
        actions={canWrite ? <Button className="rounded-full font-semibold" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={16} /> {copy.new}</Button> : undefined}
      />
      {error && <ErrorNote message={error} onRetry={reload} />}

      {canWrite && pending.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/50 bg-primary/10 p-4">
          <div className="flex items-start gap-3">
            <Repeat size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{pending.length} lançamento(s) recorrente(s) deste mês ainda não foram lançados</p>
              <p className="text-xs text-muted-foreground">{pending.slice(0, 3).map((r) => r.description).join(", ")}{pending.length > 3 ? "…" : ""}</p>
            </div>
          </div>
          <Button className="rounded-full font-semibold" onClick={() => act(() => call("POST", "/api/erp/recurring/generate", {}), "Lançamentos do mês criados.")}>Lançar agora</Button>
        </div>
      )}

      {s && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
          <Kpi label="Em aberto" value={money(s.open)} sub={`${s.open_count} lançamento(s)`} />
          <Kpi label="Atrasado" value={money(s.overdue)} tone={s.overdue > 0 ? "bad" : undefined} sub={s.overdue_count ? `${s.overdue_count} vencido(s)` : "Nada atrasado"} onClick={s.overdue > 0 ? () => setStatus("overdue") : undefined} />
          <Kpi label="Vence hoje" value={money(s.today)} tone={s.today > 0 ? "warn" : undefined} />
          <Kpi label="Próximos 7 dias" value={money(s.next7)} />
          <Kpi label={copy.paidKpi} value={money(s.paid_month)} tone={direction === "in" ? "good" : undefined} />
        </div>
      )}

      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchBox value={q} onChange={setQ} placeholder={`Buscar por descrição ou ${copy.party.toLowerCase()}…`} className="w-full sm:max-w-xs sm:flex-1" />
          <Chips label="Período de vencimento" value={period} onChange={setPeriod} options={[{ value: "all", label: "Qualquer data" }, { value: "week", label: "7 dias" }, { value: "month", label: "Este mês" }, { value: "next30", label: "30 dias" }]} />
        </div>
        <div className="mb-4">
          <Chips label="Situação" value={status} onChange={setStatus} options={[{ value: "open", label: "Em aberto" }, { value: "overdue", label: "Atrasadas" }, { value: "paid", label: copy.done + "s" }, { value: "all", label: "Todas" }]} />
        </div>
        {loading && !data ? (
          <LoadingRows />
        ) : titles.length === 0 ? (
          <EmptyState icon={copy.Icon} title={status === "open" && period === "all" && !q ? copy.empty : "Nada neste filtro"} action={canWrite && status === "open" && !q ? <Button className="rounded-full font-semibold" onClick={() => setFormOpen(true)}><Plus size={16} /> {copy.new}</Button> : undefined}>
            {status === "open" && period === "all" && !q ? copy.emptyText : "Mude a situação, o período ou a busca."}
          </EmptyState>
        ) : (
          <DataTable
            rows={titles}
            rowKey={(t) => t.id}
            columns={columns}
            mobileCard={(t) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.description}</p>
                  <p className={`text-xs ${t.overdue ? "font-semibold text-bad" : "text-muted-foreground"}`}>{t.status === "paid" ? `${copy.done} em ${fmtDate(t.paid_at)}` : `Vence ${fmtDate(t.due_date)}${t.overdue ? ` · ${t.days_late}d de atraso` : ""}`}{t.party_name ? ` · ${t.party_name}` : ""}</p>
                  {canWrite && (
                    <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {t.status === "open" && <Button size="sm" className="rounded-full" onClick={() => setPaying(t)}>{copy.action}</Button>}
                      <RowMenu t={t} onEdit={() => { setEditing(t); setFormOpen(true); }} onUnpay={() => act(() => call("POST", `/api/erp/titles/${t.id}/unpay`), "Baixa desfeita.")} onCancel={() => setCanceling(t)} />
                    </div>
                  )}
                </div>
                <span className="font-semibold tabular-nums">{money(t.amount)}</span>
              </div>
            )}
          />
        )}
      </Panel>

      <TitleFormSheet
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) { setEditing(null); clearNew(); } }}
        direction={direction}
        title={editing}
        onSaved={() => { reload(); }}
      />
      <PayDialog title={paying} onOpenChange={(o) => !o && setPaying(null)} onDone={reload} />
      <ConfirmDialog open={Boolean(canceling)} onOpenChange={(o) => !o && setCanceling(null)} title="Cancelar este lançamento?" danger confirmLabel="Cancelar lançamento" onConfirm={async () => { if (canceling) await act(() => call("DELETE", `/api/erp/titles/${canceling.id}`), "Lançamento cancelado."); setCanceling(null); }}>
        {canceling?.description}. Parcelas de vendas e compras são canceladas pelo pedido. Lançamentos já pagos precisam ter a baixa desfeita antes.
      </ConfirmDialog>
    </>
  );
}

function RowMenu({ t, onEdit, onUnpay, onCancel }: { t: Title; onEdit: () => void; onUnpay: () => void; onCancel: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Mais ações" className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
        <MoreHorizontal size={16} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {t.status === "open" && <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>}
        {t.status === "paid" && <DropdownMenuItem onClick={onUnpay}>Desfazer baixa</DropdownMenuItem>}
        {t.status === "open" && t.origin_type !== "sale" && t.origin_type !== "purchase" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onCancel} className="text-destructive">Cancelar lançamento</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------- formulário de lançamento ----------

function TitleFormSheet({ open, onOpenChange, direction, title, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; direction: "in" | "out"; title: Title | null; onSaved: () => void }) {
  return open ? <FormInner key={title?.id ?? "new"} onOpenChange={onOpenChange} direction={direction} title={title} onSaved={onSaved} /> : null;
}

function FormInner({ onOpenChange, direction, title, onSaved }: { onOpenChange: (o: boolean) => void; direction: "in" | "out"; title: Title | null; onSaved: () => void }) {
  const copy = COPY[direction];
  const cats = useApi<{ categories: Category[] }>("/api/erp/categories");
  const accounts = useApi<{ accounts: Account[] }>("/api/erp/accounts");
  const fromOrder = title?.origin_type === "sale" || title?.origin_type === "purchase";
  const [description, setDescription] = useState(title?.description ?? "");
  const [party, setParty] = useState<{ id: string; name: string } | null>(title?.party_id ? { id: title.party_id, name: title.party_name ?? "" } : null);
  const [categoryId, setCategoryId] = useState(title?.category_id ?? "");
  const [amount, setAmount] = useState(title?.amount ?? 0);
  const [due, setDue] = useState(title?.due_date ?? todayIso());
  const [installments, setInstallments] = useState(1);
  const [notes, setNotes] = useState(title?.notes ?? "");
  const [paidNow, setPaidNow] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = (cats.data?.categories ?? []).filter((c) => c.kind === direction).map((c) => ({ value: c.id, label: c.name }));
  const activeAccounts = (accounts.data?.accounts ?? []).filter((a) => a.active);

  async function save() {
    setError(null);
    if (!description.trim()) return setError("Descreva o lançamento.");
    if (amount <= 0) return setError("Informe o valor.");
    setBusy(true);
    try {
      if (title) {
        await call("PUT", `/api/erp/titles/${title.id}`, { description, party_id: party?.id ?? null, category_id: categoryId || null, amount, due_date: due, notes });
      } else {
        await call("POST", "/api/erp/titles", { direction, description, party_id: party?.id ?? null, category_id: categoryId || null, amount, due_date: due, installments, notes, paid_now: paidNow, account_id: paidNow ? accountId || activeAccounts.find((a) => a.kind === "cash")?.id || activeAccounts[0]?.id || null : null });
      }
      toast.success(title ? "Lançamento atualizado." : installments > 1 ? `${installments} parcelas lançadas.` : "Lançamento criado.");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormSheet open onOpenChange={onOpenChange} title={title ? "Editar lançamento" : copy.new} description={fromOrder ? "Esta parcela vem de um pedido: só o vencimento, a categoria e a observação podem mudar aqui." : undefined} onSubmit={save} busy={busy} error={error}>
      <Field label="Descrição" required><TextInput value={description} onChange={(e) => setDescription(e.target.value)} disabled={fromOrder} autoFocus placeholder={direction === "in" ? "Ex.: Mensalidade de outubro" : "Ex.: Aluguel da loja"} /></Field>
      <Field label={copy.party}><PartyPicker kind={copy.kind} value={party?.id ?? null} label={party?.name} onChange={(p) => setParty(p ? { id: p.id, name: p.name } : null)} placeholder="Sem vínculo" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor" required><MoneyInput value={amount} onChange={setAmount} disabled={fromOrder} /></Field>
        <Field label={installments > 1 ? "1º vencimento" : "Vencimento"} required><DateField value={due} onChange={setDue} /></Field>
      </div>
      <Field label="Categoria" hint="Serve para os relatórios e o resultado do mês."><SelectField value={categoryId} onChange={setCategoryId} options={options} placeholder="Sem categoria" /></Field>
      {!title && (
        <>
          <Field label="Repetir em parcelas mensais" hint={installments > 1 ? `O valor total é dividido em ${installments} parcelas, uma por mês.` : "1 = lançamento único."}>
            <NumberField value={installments} onChange={(n) => setInstallments(Math.min(48, Math.max(1, Math.round(n) || 1)))} suffix="x" />
          </Field>
          {installments === 1 && <Toggle checked={paidNow} onChange={setPaidNow} label={direction === "in" ? "Já recebi" : "Já paguei"} hint={`Registra como ${direction === "in" ? "recebido" : "pago"} na data de vencimento informada.`} />}
          {paidNow && <Field label={direction === "in" ? "Entrou em" : "Saiu de"}><SelectField value={accountId || activeAccounts.find((a) => a.kind === "cash")?.id || activeAccounts[0]?.id || ""} onChange={setAccountId} options={activeAccounts.map((a) => ({ value: a.id, label: a.name }))} /></Field>}
        </>
      )}
      <Field label="Observações"><TextArea value={notes} onChange={setNotes} /></Field>
    </FormSheet>
  );
}
