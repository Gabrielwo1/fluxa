"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, Pencil, Plus, Printer, Trash2, Truck, Undo2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { call, qs, useApi } from "@/lib/erp/client";
import type { Account, Party, Product, Purchase, Title } from "@/lib/erp/types";
import { fmtDate, money, qtyFmt, todayIso } from "@/lib/erp/format";
import { Chips, ConfirmDialog, DateField, EmptyState, ErrorNote, Field, FormDialog, Kpi, LoadingRows, MoneyInput, NumberField, PageHeader, SearchBox, TextArea, TextInput, useDebounced } from "@/components/erp/ui";
import { DataTable, type Column } from "@/components/erp/data-table";
import { PartyPicker, ProductPicker } from "@/components/erp/entity-picker";
import { PaymentFields, defaultPayment, toConfirmPayload, type PaymentState } from "@/components/erp/payment-fields";
import { PayDialog } from "@/components/erp/pay-dialog";
import { PurchaseStatusTag, TitleStatusTag } from "@/components/erp/status";
import { ErpGate } from "@/components/erp/gate";

const round2 = (n: number) => Math.round(n * 100) / 100;
let keySeq = 1;
const nextKey = () => keySeq++;

// ---------- lista ----------

export function PurchasesListPage() {
  return <ErpGate>{() => <List />}</ErpGate>;
}

function List() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "received" | "canceled">("all");
  const debounced = useDebounced(q);
  const { data, error, loading, reload } = useApi<{ purchases: Purchase[] }>(`/api/erp/purchases${qs({ q: debounced, status })}`);
  const purchases = useMemo(() => data?.purchases ?? [], [data]);
  const received = purchases.filter((p) => p.status === "received");

  const columns: Column<Purchase>[] = [
    { key: "n", header: "Nº", cell: (p) => <span className="font-semibold">#{p.number}</span> },
    { key: "date", header: "Data", cell: (p) => fmtDate(p.issue_date) },
    { key: "supplier", header: "Fornecedor", cell: (p) => p.supplier_name ?? <span className="text-muted-foreground">Sem fornecedor</span> },
    { key: "items", header: "Itens", align: "right", cell: (p) => p.items_count },
    { key: "total", header: "Total", align: "right", cell: (p) => <span className="font-semibold">{money(p.total)}</span> },
    { key: "status", header: "Situação", cell: (p) => <PurchaseStatusTag status={p.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Compras"
        description="O que você comprou dos fornecedores. Ao receber, o estoque sobe e a conta a pagar é criada."
        help={
          <>
            <p><strong>Rascunho</strong> é um pedido ainda não recebido: não mexe em estoque nem em dinheiro.</p>
            <p><strong>Receber mercadoria</strong> soma ao estoque, atualiza o custo dos produtos e gera as contas a pagar.</p>
          </>
        }
        actions={<Button className="rounded-full font-semibold" render={<Link href="/compras/nova" />}><Plus size={16} /> Nova compra</Button>}
      />
      {error && <ErrorNote message={error} onRetry={reload} />}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi label="Comprado (recebido)" value={money(received.reduce((s, p) => s + p.total, 0))} sub={`${received.length} compra(s)`} />
        <Kpi label="Rascunhos" value={String(purchases.filter((p) => p.status === "draft").length)} sub="Aguardando receber" />
        <Kpi label="Total listado" value={String(purchases.length)} />
      </div>
      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchBox value={q} onChange={setQ} placeholder="Buscar por fornecedor ou número…" className="w-full sm:max-w-xs sm:flex-1" />
          <Chips label="Situação" value={status} onChange={setStatus} options={[{ value: "all", label: "Todas" }, { value: "draft", label: "Rascunhos" }, { value: "received", label: "Recebidas" }, { value: "canceled", label: "Canceladas" }]} />
        </div>
        {loading && !data ? (
          <LoadingRows />
        ) : purchases.length === 0 ? (
          <EmptyState icon={Truck} title="Registre a primeira compra" action={<Button className="rounded-full font-semibold" render={<Link href="/compras/nova" />}><Plus size={16} /> Nova compra</Button>}>
            Compre dos seus fornecedores pelo sistema e o estoque e as contas a pagar se atualizam sozinhos.
          </EmptyState>
        ) : (
          <DataTable
            rows={purchases}
            rowKey={(p) => p.id}
            columns={columns}
            onRowClick={(p) => router.push(`/compras/${p.id}`)}
            mobileCard={(p) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">#{p.number} · {p.supplier_name ?? "Sem fornecedor"}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(p.issue_date)} · {p.items_count} item(ns)</p>
                  <div className="mt-1.5"><PurchaseStatusTag status={p.status} /></div>
                </div>
                <span className="font-semibold tabular-nums">{money(p.total)}</span>
              </div>
            )}
          />
        )}
      </Panel>
    </>
  );
}

// ---------- formulário ----------

type Row = { key: number; product_id: string | null; name: string; free: boolean; qty: number; cost: number; unit: string };
const blankRow = (): Row => ({ key: nextKey(), product_id: null, name: "", free: false, qty: 1, cost: 0, unit: "un" });

export function PurchaseFormPage({ purchaseId }: { purchaseId?: string }) {
  return <ErpGate>{() => <FormLoader purchaseId={purchaseId} />}</ErpGate>;
}

function FormLoader({ purchaseId }: { purchaseId?: string }) {
  const source = useApi<Purchase>(purchaseId ? `/api/erp/purchases/${purchaseId}` : null);
  const accounts = useApi<{ accounts: Account[] }>("/api/erp/accounts");
  const err = source.error || accounts.error;
  if (err) return <ErrorNote message={err} />;
  if (!accounts.data || (purchaseId && !source.data)) return <LoadingRows rows={6} />;
  if (source.data && source.data.status !== "draft") return <ErrorNote message="Só rascunhos podem ser editados." />;
  return <Form key={purchaseId ?? "new"} editing={source.data ?? null} accounts={accounts.data.accounts.filter((a) => a.active)} />;
}

function Form({ editing, accounts }: { editing: Purchase | null; accounts: Account[] }) {
  const router = useRouter();
  const [supplier, setSupplier] = useState<{ id: string; name: string } | null>(editing?.supplier_id ? { id: editing.supplier_id, name: editing.supplier_name ?? "" } : null);
  const [issue, setIssue] = useState(editing?.issue_date ?? todayIso());
  const [rows, setRows] = useState<Row[]>(() =>
    editing?.items?.length ? editing.items.map((i) => ({ key: nextKey(), product_id: i.product_id, name: i.description, free: !i.product_id, qty: i.qty, cost: i.unit_cost, unit: "un" })) : [blankRow()]
  );
  const [discount, setDiscount] = useState(editing?.discount ?? 0);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [pay, setPay] = useState<PaymentState>(() => ({ ...defaultPayment(todayIso()), mode: "later", method: "Boleto" }));
  const [busy, setBusy] = useState<"draft" | "receive" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lines = rows.map((r) => ({ ...r, total: round2(r.qty * r.cost) }));
  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
  const total = round2(Math.max(0, subtotal - discount));
  const set = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function pick(key: number, p: Product | null) {
    if (!p) return set(key, { product_id: null, name: "" });
    set(key, { product_id: p.id, name: p.name, cost: p.cost_price, unit: p.unit, free: false });
  }

  async function submit(receive: boolean) {
    setError(null);
    if (rows.every((r) => !r.name.trim())) return setError("Adicione pelo menos um item à compra.");
    for (const r of rows) {
      if (!r.name.trim()) return setError("Há um item sem produto ou descrição. Preencha ou remova.");
      if (r.qty <= 0) return setError(`Informe a quantidade de "${r.name}".`);
    }
    if (discount > subtotal) return setError("O desconto é maior que o total dos itens.");
    if (receive && pay.mode === "now" && accounts.length === 0) return setError("Cadastre um caixa ou conta em Caixas e contas.");
    setBusy(receive ? "receive" : "draft");
    const body = {
      supplier_id: supplier?.id ?? null,
      issue_date: issue,
      discount,
      notes,
      payment_method: pay.method,
      items: rows.map((r) => ({ product_id: r.product_id, description: r.name.trim(), qty: r.qty, unit_cost: r.cost })),
      receive: receive ? toConfirmPayload(pay, issue) : undefined,
    };
    try {
      const saved = editing ? await call<Purchase>("PUT", `/api/erp/purchases/${editing.id}`, body) : await call<Purchase>("POST", "/api/erp/purchases", body);
      toast.success(receive ? `Compra #${saved.number} recebida.` : `Rascunho #${saved.number} salvo.`);
      router.push(`/compras/${saved.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <>
      <Link href="/compras" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Compras</Link>
      <PageHeader title={editing ? `Editar compra #${editing.number}` : "Nova compra"} description="Registre o que comprou. Ao receber a mercadoria, o estoque sobe e a conta a pagar é criada." />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid grid-cols-1 min-w-0 gap-4">
          <Panel>
            <h2 className="mb-3 text-base font-semibold">1. Fornecedor</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
              <Field label="Fornecedor"><PartyPicker kind="supplier" value={supplier?.id ?? null} label={supplier?.name} onChange={(p: Party | null) => setSupplier(p ? { id: p.id, name: p.name } : null)} placeholder="Escolher fornecedor…" /></Field>
              <Field label="Data da compra"><DateField value={issue} onChange={setIssue} /></Field>
            </div>
          </Panel>
          <Panel>
            <h2 className="mb-3 text-base font-semibold">2. Itens comprados</h2>
            <div className="space-y-3">
              {lines.map((r) => (
                <div key={r.key} className="space-y-3 rounded-2xl border p-3">
                  <div className="flex items-start gap-2">
                    <Field label="Produto" className="flex-1">
                      {r.free ? <TextInput value={r.name} onChange={(e) => set(r.key, { name: e.target.value })} placeholder="Descreva o item" /> : <ProductPicker value={r.product_id} label={r.name} onChange={(p) => pick(r.key, p)} priceField="cost_price" />}
                      <button type="button" onClick={() => set(r.key, { free: !r.free, product_id: null, name: "" })} className="mt-1 text-xs text-muted-foreground hover:underline">{r.free ? "Escolher do catálogo" : "Item avulso (fora do catálogo)"}</button>
                    </Field>
                    <button type="button" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [blankRow()]))} aria-label="Remover item" className="mt-7 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 size={16} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Field label="Quantidade"><NumberField value={r.qty} onChange={(n) => set(r.key, { qty: n })} suffix={r.free ? undefined : r.unit} /></Field>
                    <Field label="Custo unitário"><MoneyInput value={r.cost} onChange={(n) => set(r.key, { cost: n })} /></Field>
                    <div className="col-span-2 sm:col-span-1"><p className="mb-1.5 text-sm font-medium">Total do item</p><p className="flex h-11 items-center text-lg font-bold tabular-nums">{money(r.total)}</p></div>
                  </div>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" className="mt-4 rounded-full" onClick={() => setRows((rs) => [...rs, blankRow()])}><Plus size={16} /> Adicionar item</Button>
          </Panel>
          <Panel><Field label="Observações"><TextArea value={notes} onChange={setNotes} /></Field></Panel>
        </div>
        <div className="grid grid-cols-1 min-w-0 gap-4 lg:sticky lg:top-4">
          <Panel>
            <h2 className="mb-3 text-base font-semibold">3. Pagamento</h2>
            <dl className="mb-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{money(subtotal)}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">Desconto</dt><dd className="w-32"><MoneyInput value={discount} onChange={setDiscount} /></dd></div>
              <div className="flex justify-between border-t pt-2 text-lg font-bold"><dt>Total</dt><dd className="tabular-nums">{money(total)}</dd></div>
            </dl>
            <PaymentFields value={pay} onChange={setPay} total={total} direction="out" accounts={accounts} issueDate={issue} />
          </Panel>
          {error && <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-12 rounded-full font-semibold" disabled={busy !== null} onClick={() => submit(false)}>{busy === "draft" ? <Loader2 size={16} className="animate-spin" /> : "Salvar rascunho"}</Button>
            <Button type="button" className="h-12 rounded-full font-semibold" disabled={busy !== null} onClick={() => submit(true)}>{busy === "receive" ? <Loader2 size={16} className="animate-spin" /> : "Receber mercadoria"}</Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">Receber soma ao estoque e cria a conta a pagar. Rascunho não altera nada.</p>
        </div>
      </div>
    </>
  );
}

// ---------- detalhe ----------

export function PurchaseDetailPage({ id }: { id: string }) {
  return <ErpGate>{(st) => <Detail id={id} canWrite={st.canWrite} />}</ErpGate>;
}

function Detail({ id, canWrite }: { id: string; canWrite: boolean }) {
  const router = useRouter();
  const { data: p, error, reload } = useApi<Purchase>(`/api/erp/purchases/${id}`);
  const accounts = useApi<{ accounts: Account[] }>("/api/erp/accounts");
  const [receiving, setReceiving] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [paying, setPaying] = useState<Title | null>(null);
  const [pay, setPay] = useState<PaymentState>(() => ({ ...defaultPayment(todayIso()), mode: "later", method: "Boleto" }));
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (error) return <ErrorNote message={error} />;
  if (!p) return <LoadingRows rows={6} />;

  async function receive() {
    if (!p) return;
    setBusy(true);
    setFormError(null);
    try {
      await call("POST", `/api/erp/purchases/${id}/receive`, toConfirmPayload(pay, p.issue_date));
      toast.success(`Compra #${p.number} recebida.`);
      setReceiving(false);
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
      <Link href="/compras" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground print:hidden"><ArrowLeft size={15} /> Compras</Link>
      <PageHeader
        title={`Compra #${p.number}`}
        description={`${fmtDate(p.issue_date)}${p.supplier_name ? ` · ${p.supplier_name}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <PurchaseStatusTag status={p.status} />
            <Button variant="outline" className="rounded-full" onClick={() => window.print()}><Printer size={15} /> Imprimir</Button>
            {canWrite && p.status === "draft" && (
              <>
                <Button variant="outline" className="rounded-full" render={<Link href={`/compras/${p.id}/editar`} />}><Pencil size={15} /> Editar</Button>
                <Button className="rounded-full font-semibold" onClick={() => { setPay({ ...defaultPayment(p.issue_date), mode: "later", method: "Boleto" }); setFormError(null); setReceiving(true); }}><Check size={15} /> Receber mercadoria</Button>
                <Button variant="ghost" className="rounded-full text-destructive" onClick={() => setDeleting(true)}><Trash2 size={15} /></Button>
              </>
            )}
            {canWrite && p.status === "received" && <Button variant="outline" className="rounded-full text-destructive" onClick={() => setCanceling(true)}><XCircle size={15} /> Cancelar compra</Button>}
          </div>
        }
      />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid grid-cols-1 min-w-0 gap-4">
          <Panel>
            <h2 className="mb-3 text-base font-semibold">Itens</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2 text-left font-medium">Item</th><th className="px-2 py-2 text-right font-medium">Qtd.</th><th className="px-2 py-2 text-right font-medium">Custo</th><th className="py-2 text-right font-medium">Total</th></tr></thead>
                <tbody className="divide-y">
                  {(p.items ?? []).map((i, idx) => (
                    <tr key={i.id ?? idx}><td className="py-2.5 pr-2 font-medium">{i.description}</td><td className="px-2 py-2.5 text-right tabular-nums">{qtyFmt(i.qty)}</td><td className="px-2 py-2.5 text-right tabular-nums">{money(i.unit_cost)}</td><td className="py-2.5 text-right font-semibold tabular-nums">{money(i.total)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{money(p.subtotal)}</dd></div>
              {p.discount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Desconto</dt><dd className="tabular-nums">− {money(p.discount)}</dd></div>}
              <div className="flex justify-between border-t pt-2 text-lg font-bold"><dt>Total</dt><dd className="tabular-nums">{money(p.total)}</dd></div>
            </dl>
            {p.notes && <p className="mt-4 rounded-xl bg-muted px-3 py-2 text-sm"><span className="font-medium">Observações: </span>{p.notes}</p>}
          </Panel>
          {p.status !== "draft" && (
            <Panel>
              <h2 className="mb-3 text-base font-semibold">Pagamento</h2>
              {(p.titles ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma conta a pagar gerada.</p> : (
                <ul className="divide-y">
                  {(p.titles ?? []).map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t.installment_total ? `Parcela ${t.installment_no}/${t.installment_total}` : "Pagamento único"} · vence {fmtDate(t.due_date)}</p>
                        <p className="text-xs text-muted-foreground">{t.status === "paid" ? `Pago em ${fmtDate(t.paid_at)}${t.account_name ? ` · ${t.account_name}` : ""}` : t.status === "canceled" ? "Cancelada" : t.overdue ? `Atrasada há ${t.days_late} dias` : "Aguardando"}</p>
                      </div>
                      <div className="flex items-center gap-2 print:hidden">
                        <span className="text-sm font-semibold tabular-nums">{money(t.amount)}</span>
                        {t.status !== "canceled" && <TitleStatusTag title={t} />}
                        {canWrite && t.status === "open" && p.status === "received" && <Button size="sm" className="rounded-full" onClick={() => setPaying(t)}>Pagar</Button>}
                        {canWrite && t.status === "paid" && p.status === "received" && <Button size="sm" variant="ghost" className="rounded-full" title="Desfazer pagamento" onClick={() => act(() => call("POST", `/api/erp/titles/${t.id}/unpay`), "Pagamento desfeito.")}><Undo2 size={14} /></Button>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
        <Panel>
          <h2 className="mb-3 text-base font-semibold">Resumo</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Fornecedor</dt><dd className="text-right font-medium">{p.supplier_name ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Forma de pagamento</dt><dd className="font-medium">{p.payment_method || "—"}</dd></div>
            {p.received_at && <div className="flex justify-between"><dt className="text-muted-foreground">Recebida em</dt><dd className="font-medium">{fmtDate(p.received_at)}</dd></div>}
          </dl>
          {p.status === "draft" && <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">Este rascunho ainda não mexeu em estoque nem em financeiro.</p>}
        </Panel>
      </div>

      <FormDialog open={receiving} onOpenChange={setReceiving} title="Receber mercadoria" description={`Total ${money(p.total)}. Defina como será o pagamento ao fornecedor.`} submitLabel="Receber" onSubmit={receive} busy={busy} error={formError}>
        <PaymentFields value={pay} onChange={setPay} total={p.total} direction="out" accounts={(accounts.data?.accounts ?? []).filter((a) => a.active)} issueDate={p.issue_date} />
      </FormDialog>
      <ConfirmDialog open={canceling} onOpenChange={setCanceling} title={`Cancelar a compra #${p.number}?`} danger confirmLabel="Cancelar compra" onConfirm={async () => { await act(() => call("POST", `/api/erp/purchases/${id}/cancel`), "Compra cancelada."); setCanceling(false); }}>
        O estoque recebido é retirado e as parcelas em aberto são canceladas. Se alguma parcela já foi paga, desfaça o pagamento antes.
      </ConfirmDialog>
      <ConfirmDialog open={deleting} onOpenChange={setDeleting} title="Excluir este rascunho?" danger confirmLabel="Excluir" onConfirm={async () => { try { await call("DELETE", `/api/erp/purchases/${id}`); toast.success("Rascunho excluído."); router.push("/compras"); } catch (e) { toast.error((e as Error).message); setDeleting(false); } }}>Não dá para desfazer.</ConfirmDialog>
      <PayDialog title={paying} onOpenChange={(o) => !o && setPaying(null)} onDone={reload} />
    </>
  );
}
