"use client";

import { useMemo, useState } from "react";
import { Banknote, Landmark, Pencil, Plus, Repeat, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/components/finance-provider";
import { call, qs, useApi } from "@/lib/erp/client";
import type { Account, Category, Recurring } from "@/lib/erp/types";
import { fmtDate, money, monthShort } from "@/lib/erp/format";
import { BalanceLine } from "@/components/erp/charts";
import { Chips, ConfirmDialog, EmptyState, ErrorNote, Field, FormSheet, Kpi, LoadingRows, MoneyInput, NumberField, PageHeader, SelectField, TextInput, Toggle, Tag } from "@/components/erp/ui";
import { PartyPicker } from "@/components/erp/entity-picker";
import { ErpGate } from "@/components/erp/gate";

// ---------- caixas e contas ----------

const KIND_LABEL = { cash: "Caixa", bank: "Conta bancária", wallet: "Carteira digital" } as const;

export function AccountsPage() {
  return <ErpGate>{(st) => <Accounts canWrite={st.canWrite} />}</ErpGate>;
}

function Accounts({ canWrite }: { canWrite: boolean }) {
  const { data, error, loading, reload } = useApi<{ accounts: Account[] }>("/api/erp/accounts");
  const { totalBalance, itemIds } = useFinance();
  const [editing, setEditing] = useState<Account | null>(null);
  const [open, setOpen] = useState(false);
  const accounts = data?.accounts ?? [];
  const active = accounts.filter((a) => a.active);
  const total = active.reduce((s, a) => s + a.balance, 0);

  return (
    <>
      <PageHeader
        title="Caixas e contas"
        description="Onde o dinheiro da empresa está. Cada recebimento e pagamento entra ou sai de um deles."
        help={
          <>
            <p>Cadastre o <strong>caixa</strong> (dinheiro na gaveta), as <strong>contas bancárias</strong> e carteiras digitais. O saldo é o saldo inicial mais tudo que foi recebido, menos tudo que foi pago.</p>
            <p>Se você conectou o banco pelo Open Finance, o saldo real dele aparece ao lado para conferir.</p>
          </>
        }
        actions={canWrite ? <Button className="rounded-full font-semibold" onClick={() => { setEditing(null); setOpen(true); }}><Plus size={16} /> Nova conta ou caixa</Button> : undefined}
      />
      {error && <ErrorNote message={error} onRetry={reload} />}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi label="Saldo total no sistema" value={money(total)} tone={total < 0 ? "bad" : undefined} />
        <Kpi label="Contas ativas" value={String(active.length)} />
        {itemIds.length > 0 && <Kpi label="Saldo real nos bancos (Open Finance)" value={money(totalBalance)} sub="Para conferir com o saldo do sistema" />}
      </div>
      <Panel>
        {loading && !data ? (
          <LoadingRows rows={3} />
        ) : accounts.length === 0 ? (
          <EmptyState icon={Wallet} title="Nenhuma conta cadastrada">Cadastre um caixa ou conta para registrar recebimentos e pagamentos.</EmptyState>
        ) : (
          <ul className="divide-y">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20">{a.kind === "cash" ? <Banknote size={18} /> : a.kind === "bank" ? <Landmark size={18} /> : <Wallet size={18} />}</span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.name} {!a.active && <Tag>Inativa</Tag>}</p>
                    <p className="text-xs text-muted-foreground">{KIND_LABEL[a.kind]} · saldo inicial {money(a.initial_balance)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-bold tabular-nums ${a.balance < 0 ? "text-bad" : ""}`}>{money(a.balance)}</span>
                  {canWrite && <Button size="icon" variant="ghost" className="rounded-full" aria-label={`Editar ${a.name}`} onClick={() => { setEditing(a); setOpen(true); }}><Pencil size={15} /></Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {open && <AccountForm key={editing?.id ?? "new"} account={editing} onOpenChange={setOpen} onSaved={reload} />}
    </>
  );
}

function AccountForm({ account, onOpenChange, onSaved }: { account: Account | null; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [name, setName] = useState(account?.name ?? "");
  const [kind, setKind] = useState<Account["kind"]>(account?.kind ?? "bank");
  const [initial, setInitial] = useState(account?.initial_balance ?? 0);
  const [active, setActive] = useState(account?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setError(null);
    if (!name.trim()) return setError("Informe o nome.");
    setBusy(true);
    try {
      const body = { name, kind, initial_balance: initial, active };
      if (account) await call("PUT", `/api/erp/accounts/${account.id}`, body);
      else await call("POST", "/api/erp/accounts", body);
      toast.success("Conta salva.");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <FormSheet open onOpenChange={onOpenChange} title={account ? "Editar conta" : "Nova conta ou caixa"} onSubmit={save} busy={busy} error={error}>
      <Field label="Nome" required><TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Ex.: Caixa da loja, Banco Inter" /></Field>
      <Field label="Tipo"><SelectField value={kind} onChange={(v) => setKind(v as Account["kind"])} options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))} /></Field>
      <Field label="Saldo inicial" hint="Quanto havia nesta conta quando você começou a usar o sistema. Pode ser negativo."><MoneyInput value={initial} onChange={setInitial} /></Field>
      <Toggle checked={active} onChange={setActive} label="Ativa" hint="Contas inativas não aparecem na hora de receber ou pagar." />
    </FormSheet>
  );
}

// ---------- recorrências ----------

export function RecurringPage() {
  return <ErpGate>{(st) => <Recurrings canWrite={st.canWrite} />}</ErpGate>;
}

function Recurrings({ canWrite }: { canWrite: boolean }) {
  const { data, error, loading, reload } = useApi<{ recurring: Recurring[] }>("/api/erp/recurring");
  const [editing, setEditing] = useState<Recurring | null>(null);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<Recurring | null>(null);
  const [busy, setBusy] = useState(false);
  const items = data?.recurring ?? [];
  const active = items.filter((r) => r.active);
  const pending = active.filter((r) => !r.generated_this_month);
  const monthIn = active.filter((r) => r.direction === "in").reduce((s, r) => s + r.amount, 0);
  const monthOut = active.filter((r) => r.direction === "out").reduce((s, r) => s + r.amount, 0);

  async function generate() {
    setBusy(true);
    try {
      const r = await call<{ created: number }>("POST", "/api/erp/recurring/generate", {});
      toast.success(r.created ? `${r.created} lançamento(s) criado(s) em Contas a receber e a pagar.` : "Tudo já estava lançado.");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Recorrências"
        description="Contas e cobranças que se repetem todo mês: aluguel, internet, mensalidade de clientes."
        help={
          <>
            <p>Cadastre uma vez e, a cada mês, clique em <strong>Lançar do mês</strong>: o sistema cria as contas a pagar e a receber com o valor e o dia certos.</p>
            <p>Clicar de novo no mesmo mês não duplica nada.</p>
          </>
        }
        actions={
          canWrite ? (
            <>
              <Button variant="outline" className="rounded-full" disabled={busy || pending.length === 0} onClick={generate}><Repeat size={16} /> Lançar do mês{pending.length ? ` (${pending.length})` : ""}</Button>
              <Button className="rounded-full font-semibold" onClick={() => { setEditing(null); setOpen(true); }}><Plus size={16} /> Nova recorrência</Button>
            </>
          ) : undefined
        }
      />
      {error && <ErrorNote message={error} onRetry={reload} />}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi label="Entra todo mês" value={money(monthIn)} tone="good" />
        <Kpi label="Sai todo mês" value={money(monthOut)} />
        <Kpi label="Resultado fixo" value={money(monthIn - monthOut)} tone={monthIn - monthOut < 0 ? "bad" : "good"} hint="O que sobra (ou falta) só com as recorrências." />
      </div>
      <Panel>
        {loading && !data ? (
          <LoadingRows rows={3} />
        ) : items.length === 0 ? (
          <EmptyState icon={Repeat} title="Nenhuma recorrência" action={canWrite ? <Button className="rounded-full font-semibold" onClick={() => setOpen(true)}><Plus size={16} /> Cadastrar a primeira</Button> : undefined}>
            Cadastre o aluguel, a internet e as mensalidades dos clientes para o financeiro se preencher quase sozinho.
          </EmptyState>
        ) : (
          <ul className="divide-y">
            {items.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.description}</p>
                  <p className="text-xs text-muted-foreground">todo dia {r.day} · {r.direction === "in" ? "receber" : "pagar"}{r.party_name ? ` · ${r.party_name}` : ""}{r.category_name ? ` · ${r.category_name}` : ""}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!r.active ? <Tag>Pausada</Tag> : r.generated_this_month ? <Tag tone="good">Lançada</Tag> : <Tag tone="warn">Falta lançar</Tag>}
                  <span className={`font-semibold tabular-nums ${r.direction === "in" ? "text-good" : ""}`}>{r.direction === "in" ? "+ " : ""}{money(r.amount)}</span>
                  {canWrite && <Button size="icon" variant="ghost" className="rounded-full" aria-label={`Editar ${r.description}`} onClick={() => { setEditing(r); setOpen(true); }}><Pencil size={15} /></Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {open && <RecurringForm key={editing?.id ?? "new"} item={editing} onOpenChange={setOpen} onSaved={reload} onDelete={(r) => { setOpen(false); setRemoving(r); }} />}
      <ConfirmDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)} title="Excluir esta recorrência?" danger confirmLabel="Excluir" onConfirm={async () => { if (removing) { try { await call("DELETE", `/api/erp/recurring/${removing.id}`); toast.success("Recorrência excluída."); reload(); } catch (e) { toast.error((e as Error).message); } } setRemoving(null); }}>
        Os lançamentos que ela já criou continuam no financeiro. Só os próximos meses deixam de ser criados.
      </ConfirmDialog>
    </>
  );
}

function RecurringForm({ item, onOpenChange, onSaved, onDelete }: { item: Recurring | null; onOpenChange: (o: boolean) => void; onSaved: () => void; onDelete: (r: Recurring) => void }) {
  const cats = useApi<{ categories: Category[] }>("/api/erp/categories");
  const [direction, setDirection] = useState<"in" | "out">(item?.direction ?? "out");
  const [description, setDescription] = useState(item?.description ?? "");
  const [party, setParty] = useState<{ id: string; name: string } | null>(item?.party_id ? { id: item.party_id, name: item.party_name ?? "" } : null);
  const [categoryId, setCategoryId] = useState(item?.category_id ?? "");
  const [amount, setAmount] = useState(item?.amount ?? 0);
  const [day, setDay] = useState(item?.day ?? 5);
  const [active, setActive] = useState(item?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = (cats.data?.categories ?? []).filter((c) => c.kind === direction).map((c) => ({ value: c.id, label: c.name }));

  async function save() {
    setError(null);
    if (!description.trim()) return setError("Descreva o lançamento.");
    if (amount <= 0) return setError("Informe o valor.");
    if (day < 1 || day > 31) return setError("O dia precisa estar entre 1 e 31.");
    setBusy(true);
    try {
      const body = { direction, description, party_id: party?.id ?? null, category_id: categoryId || null, amount, day, active };
      if (item) await call("PUT", `/api/erp/recurring/${item.id}`, body);
      else await call("POST", "/api/erp/recurring", body);
      toast.success("Recorrência salva.");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormSheet open onOpenChange={onOpenChange} title={item ? "Editar recorrência" : "Nova recorrência"} onSubmit={save} busy={busy} error={error} extraActions={item ? <Button type="button" variant="ghost" className="mr-auto rounded-full text-destructive hover:text-destructive" onClick={() => onDelete(item)}>Excluir</Button> : undefined}>
      <div className="grid grid-cols-2 gap-2">
        {([["out", "Conta a pagar", "Aluguel, internet, assinatura"], ["in", "Conta a receber", "Mensalidade de cliente"]] as const).map(([v, label, hint]) => (
          <button key={v} type="button" aria-pressed={direction === v} onClick={() => { setDirection(v); setCategoryId(""); setParty(null); }} className={`rounded-xl border p-3 text-left transition-colors ${direction === v ? "border-primary bg-primary/15" : "hover:bg-muted"}`}>
            <span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span>
          </button>
        ))}
      </div>
      <Field label="Descrição" required><TextInput value={description} onChange={(e) => setDescription(e.target.value)} autoFocus placeholder={direction === "in" ? "Ex.: Mensalidade da Escola Aprender" : "Ex.: Aluguel da loja"} /></Field>
      <Field label={direction === "in" ? "Cliente" : "Fornecedor"}><PartyPicker kind={direction === "in" ? "customer" : "supplier"} value={party?.id ?? null} label={party?.name} onChange={(p) => setParty(p ? { id: p.id, name: p.name } : null)} placeholder="Sem vínculo" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor" required><MoneyInput value={amount} onChange={setAmount} /></Field>
        <Field label="Dia do mês" hint="Em meses curtos, usa o último dia."><NumberField value={day} onChange={(n) => setDay(Math.round(n))} /></Field>
      </div>
      <Field label="Categoria"><SelectField value={categoryId} onChange={setCategoryId} options={options} placeholder="Sem categoria" /></Field>
      <Toggle checked={active} onChange={setActive} label="Ativa" hint="Pausadas não geram lançamentos nos próximos meses." />
    </FormSheet>
  );
}

// ---------- fluxo de caixa ----------

type Cashflow = {
  days: number;
  opening: number;
  overdue_in: number;
  overdue_out: number;
  total_in: number;
  total_out: number;
  closing: number;
  lowest: { date: string; balance: number };
  series: { date: string; in: number; out: number; balance: number }[];
};

export function CashflowPage() {
  return <ErpGate>{() => <Flow />}</ErpGate>;
}

function Flow() {
  const [days, setDays] = useState<30 | 60 | 90>(60);
  const { data, error, loading, reload } = useApi<Cashflow>(`/api/erp/cashflow${qs({ days })}`);
  const weeks = useMemo(() => {
    if (!data) return [];
    const out: { label: string; in: number; out: number; balance: number }[] = [];
    for (let i = 0; i < data.series.length; i += 7) {
      const chunk = data.series.slice(i, i + 7);
      out.push({
        label: `${fmtDate(chunk[0].date).slice(0, 5)} a ${fmtDate(chunk[chunk.length - 1].date).slice(0, 5)}`,
        in: chunk.reduce((s, d) => s + d.in, 0),
        out: chunk.reduce((s, d) => s + d.out, 0),
        balance: chunk[chunk.length - 1].balance,
      });
    }
    return out;
  }, [data]);
  const negative = data ? data.lowest.balance < 0 : false;

  return (
    <>
      <PageHeader
        title="Fluxo de caixa"
        description="Para onde o saldo caminha nos próximos dias, olhando o que você tem hoje, o que vai receber e o que vai pagar."
        help={
          <>
            <p>Começa pelo saldo das suas contas e caixas. Depois soma cada conta a receber e subtrai cada conta a pagar, no dia do vencimento.</p>
            <p>O que já venceu e não foi baixado entra no primeiro dia, porque ainda precisa acontecer. Quanto mais completo o financeiro, mais confiável o gráfico.</p>
          </>
        }
        actions={<Chips label="Horizonte" value={String(days) as "30" | "60" | "90"} onChange={(v) => setDays(Number(v) as 30 | 60 | 90)} options={[{ value: "30", label: "30 dias" }, { value: "60", label: "60 dias" }, { value: "90", label: "90 dias" }]} />}
      />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data ? (
        <LoadingRows rows={5} />
      ) : data ? (
        <>
          {negative && (
            <div className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <p className="font-semibold text-destructive">Atenção: o saldo previsto fica negativo</p>
              <p className="mt-0.5 text-muted-foreground">Em {fmtDate(data.lowest.date)} o saldo chega a {money(data.lowest.balance)}. Antecipe recebimentos, negocie vencimentos ou separe dinheiro antes dessa data.</p>
            </div>
          )}
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
            <Kpi label="Saldo hoje" value={money(data.opening)} tone={data.opening < 0 ? "bad" : undefined} />
            <Kpi label="Vai entrar" value={money(data.total_in)} tone="good" sub={data.overdue_in ? `${money(data.overdue_in)} já vencido` : undefined} />
            <Kpi label="Vai sair" value={money(data.total_out)} sub={data.overdue_out ? `${money(data.overdue_out)} já vencido` : undefined} />
            <Kpi label={`Saldo em ${data.days} dias`} value={money(data.closing)} tone={data.closing < 0 ? "bad" : undefined} />
            <Kpi label="Menor saldo" value={money(data.lowest.balance)} tone={negative ? "bad" : undefined} sub={fmtDate(data.lowest.date)} hint="O ponto mais apertado do período." />
          </div>
          <Panel className="mb-4">
            <h2 className="mb-2 text-base font-semibold">Saldo previsto dia a dia</h2>
            <BalanceLine points={data.series} />
          </Panel>
          <Panel>
            <h2 className="mb-3 text-base font-semibold">Semana a semana</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2 text-left font-medium">Semana</th><th className="px-2 py-2 text-right font-medium">Entra</th><th className="px-2 py-2 text-right font-medium">Sai</th><th className="py-2 text-right font-medium">Saldo no fim</th></tr></thead>
                <tbody className="divide-y">
                  {weeks.map((w) => (
                    <tr key={w.label}><td className="py-2.5">{w.label}</td><td className="px-2 py-2.5 text-right tabular-nums text-good">{w.in ? money(w.in) : "—"}</td><td className="px-2 py-2.5 text-right tabular-nums">{w.out ? money(w.out) : "—"}</td><td className={`py-2.5 text-right font-semibold tabular-nums ${w.balance < 0 ? "text-bad" : ""}`}>{money(w.balance)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Mês de referência: {monthShort(data.series[0]?.date.slice(0, 7) ?? "2026-01")}. Só considera contas em aberto no financeiro; compras e vendas sem parcelas lançadas não aparecem.</p>
          </Panel>
        </>
      ) : null}
    </>
  );
}
