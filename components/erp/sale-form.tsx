"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { call, useApi } from "@/lib/erp/client";
import type { Account, Company, Party, Product, Sale } from "@/lib/erp/types";
import { money, qtyFmt, todayIso } from "@/lib/erp/format";
import { DateField, ErrorNote, Field, LoadingRows, MoneyInput, NumberField, PageHeader, TextArea, TextInput } from "@/components/erp/ui";
import { PartyPicker, ProductPicker } from "@/components/erp/entity-picker";
import { PaymentFields, defaultPayment, toConfirmPayload, type PaymentState } from "@/components/erp/payment-fields";
import { ErpGate } from "@/components/erp/gate";

type Row = {
  key: number;
  product_id: string | null;
  name: string;
  free: boolean;
  qty: number;
  price: number;
  discount: number;
  unit: string;
  track: boolean;
  stock: number | undefined;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

// chave estável para cada linha de item (só serve para o React)
let keySeq = 1;
const nextKey = () => keySeq++;

// Carrega o que precisa (venda a editar ou duplicar) e só então monta o formulário.
export function SaleFormPage({ saleId, duplicateId, customerId }: { saleId?: string; duplicateId?: string; customerId?: string }) {
  return <ErpGate>{() => <Loader saleId={saleId} duplicateId={duplicateId} customerId={customerId} />}</ErpGate>;
}

function Loader({ saleId, duplicateId, customerId }: { saleId?: string; duplicateId?: string; customerId?: string }) {
  const sourceId = saleId ?? duplicateId ?? null;
  const source = useApi<Sale>(sourceId ? `/api/erp/sales/${sourceId}` : null);
  const accounts = useApi<{ accounts: Account[] }>("/api/erp/accounts");
  const company = useApi<Company>("/api/erp/company");
  const customer = useApi<{ party: Party }>(customerId && !sourceId ? `/api/erp/parties/${customerId}` : null);
  const err = source.error || accounts.error || company.error;
  const ready = accounts.data && company.data && (!sourceId || source.data) && (!customerId || sourceId || customer.data || customer.error);

  if (err) return <ErrorNote message={err} />;
  if (!ready) return <LoadingRows rows={6} />;
  if (saleId && source.data && source.data.status !== "quote") {
    return <ErrorNote message="Só orçamentos podem ser editados. Esta venda já foi confirmada ou cancelada." />;
  }
  return (
    <Form
      key={sourceId ?? "new"}
      editing={saleId ? source.data! : null}
      template={sourceId ? source.data! : null}
      initialCustomer={customer.data?.party ?? null}
      accounts={(accounts.data?.accounts ?? []).filter((a) => a.active)}
      allowNegative={Boolean(company.data?.allow_negative_stock)}
    />
  );
}

function Form({
  editing,
  template,
  initialCustomer,
  accounts,
  allowNegative,
}: {
  editing: Sale | null;
  template: Sale | null;
  initialCustomer: Party | null;
  accounts: Account[];
  allowNegative: boolean;
}) {
  const router = useRouter();
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(
    template?.customer_id ? { id: template.customer_id, name: template.customer_name ?? "" } : initialCustomer ? { id: initialCustomer.id, name: initialCustomer.name } : null
  );
  const [issue, setIssue] = useState(editing?.issue_date ?? todayIso());
  const [rows, setRows] = useState<Row[]>(() =>
    template?.items?.length
      ? template.items.map((i) => ({ key: nextKey(), product_id: i.product_id, name: i.description, free: !i.product_id, qty: i.qty, price: i.unit_price, discount: i.discount, unit: "un", track: false, stock: undefined }))
      : [blankRow(nextKey())]
  );
  const [discount, setDiscount] = useState(template?.discount ?? 0);
  const [notes, setNotes] = useState(template?.notes ?? "");
  const [pay, setPay] = useState<PaymentState>(() => defaultPayment(todayIso()));
  const [busy, setBusy] = useState<"quote" | "confirm" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lines = rows.map((r) => ({ ...r, total: round2(Math.max(0, r.qty * r.price - r.discount)) }));
  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
  const total = round2(Math.max(0, subtotal - discount));
  const set = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function pickProduct(key: number, p: Product | null) {
    if (!p) return set(key, { product_id: null, name: "", stock: undefined, track: false });
    set(key, { product_id: p.id, name: p.name, price: p.sale_price, unit: p.unit, track: p.track_stock, stock: p.stock, qty: rows.find((r) => r.key === key)?.qty || 1, free: false });
  }

  function validate(confirm: boolean): string | null {
    if (rows.every((r) => !r.name.trim())) return "Adicione pelo menos um item à venda.";
    for (const r of rows) {
      if (!r.name.trim()) return "Há um item sem produto ou descrição. Preencha ou remova.";
      if (r.qty <= 0) return `Informe a quantidade de "${r.name}".`;
      if (r.discount > r.qty * r.price) return `O desconto de "${r.name}" é maior que o valor do item.`;
      if (confirm && !allowNegative && r.track && r.stock !== undefined && r.qty > r.stock) {
        return `Estoque insuficiente de "${r.name}": você tem ${qtyFmt(r.stock)} e quer vender ${qtyFmt(r.qty)}.`;
      }
    }
    if (discount > subtotal) return "O desconto geral é maior que o total dos itens.";
    if (confirm && pay.mode === "later" && !customer && total > 0) return "Para vender a prazo, escolha o cliente.";
    if (confirm && accounts.length === 0 && pay.mode === "now") return "Cadastre um caixa ou conta em Caixas e contas para registrar o recebimento.";
    return null;
  }

  async function submit(confirm: boolean) {
    setError(null);
    const problem = validate(confirm);
    if (problem) return setError(problem);
    setBusy(confirm ? "confirm" : "quote");
    const body = {
      customer_id: customer?.id ?? null,
      issue_date: issue,
      discount,
      notes,
      payment_method: pay.method,
      items: rows.map((r) => ({ product_id: r.product_id, description: r.name.trim(), qty: r.qty, unit_price: r.price, discount: r.discount })),
      confirm: confirm ? toConfirmPayload(pay, issue) : undefined,
    };
    try {
      const saved = editing ? await call<Sale>("PUT", `/api/erp/sales/${editing.id}`, body) : await call<Sale>("POST", "/api/erp/sales", body);
      toast.success(confirm ? `Venda #${saved.number} confirmada.` : `Orçamento #${saved.number} salvo.`);
      router.push(`/vendas/${saved.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <>
      <Link href="/vendas" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={15} /> Vendas
      </Link>
      <PageHeader
        title={editing ? `Editar orçamento #${editing.number}` : template ? "Nova venda (cópia)" : "Nova venda"}
        description="Escolha o cliente, adicione os itens e defina como vai ser pago. Salve como orçamento para negociar ou confirme para dar baixa no estoque e gerar a cobrança."
        help={
          <>
            <p><strong>Orçamento</strong> não mexe em nada: serve para o cliente aprovar. Dá para editar e depois confirmar.</p>
            <p><strong>Confirmar venda</strong> baixa o estoque e cria as contas a receber. Depois de confirmada, só dá para cancelar.</p>
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid grid-cols-1 min-w-0 gap-4">
          <Panel>
            <h2 className="mb-3 text-base font-semibold">1. Cliente</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
              <Field label="Cliente" hint="Deixe em branco para venda de balcão (sem cadastro).">
                <PartyPicker kind="customer" value={customer?.id ?? null} label={customer?.name} onChange={(p) => setCustomer(p ? { id: p.id, name: p.name } : null)} placeholder="Consumidor final (balcão)" />
              </Field>
              <Field label="Data da venda">
                <DateField value={issue} onChange={setIssue} />
              </Field>
            </div>
          </Panel>

          <Panel>
            <h2 className="mb-3 text-base font-semibold">2. Itens</h2>
            <div className="space-y-3">
              {lines.map((r) => {
                const short = !allowNegative && r.track && r.stock !== undefined && r.qty > r.stock;
                return (
                  <div key={r.key} className="space-y-3 rounded-2xl border p-3">
                    <div className="flex items-start gap-2">
                      <Field label="Produto ou serviço" className="flex-1">
                        {r.free ? (
                          <TextInput value={r.name} onChange={(e) => set(r.key, { name: e.target.value })} placeholder="Descreva o item avulso" />
                        ) : (
                          <ProductPicker value={r.product_id} label={r.name} onChange={(p) => pickProduct(r.key, p)} />
                        )}
                        <button type="button" onClick={() => set(r.key, { free: !r.free, product_id: null, name: "", track: false, stock: undefined })} className="mt-1 text-xs text-muted-foreground underline-offset-2 hover:underline">
                          {r.free ? "Escolher do catálogo" : "Item avulso (fora do catálogo)"}
                        </button>
                      </Field>
                      <button
                        type="button"
                        onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [blankRow(nextKey())]))}
                        aria-label="Remover item"
                        className="mt-7 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-destructive"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Field label="Quantidade" error={short ? `Só ${qtyFmt(r.stock ?? 0)} em estoque` : null}>
                        <NumberField value={r.qty} onChange={(n) => set(r.key, { qty: n })} suffix={r.free ? undefined : r.unit} />
                      </Field>
                      <Field label="Preço unitário">
                        <MoneyInput value={r.price} onChange={(n) => set(r.key, { price: n })} />
                      </Field>
                      <Field label="Desconto (R$)">
                        <MoneyInput value={r.discount} onChange={(n) => set(r.key, { discount: n })} />
                      </Field>
                      <div>
                        <p className="mb-1.5 text-sm font-medium">Total do item</p>
                        <p className="flex h-11 items-center text-lg font-bold tabular-nums">{money(r.total)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button type="button" variant="outline" className="mt-4 rounded-full" onClick={() => setRows((rs) => [...rs, blankRow(nextKey())])}>
              <Plus size={16} /> Adicionar item
            </Button>
          </Panel>

          <Panel>
            <Field label="Observações" hint="Aparece na venda. Use para combinados de entrega, garantia, etc.">
              <TextArea value={notes} onChange={setNotes} />
            </Field>
          </Panel>
        </div>

        <div className="grid grid-cols-1 min-w-0 gap-4 lg:sticky lg:top-4">
          <Panel>
            <h2 className="mb-3 text-base font-semibold">3. Pagamento</h2>
            <dl className="mb-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{money(subtotal)}</dd></div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Desconto geral</dt>
                <dd className="w-32"><MoneyInput value={discount} onChange={setDiscount} /></dd>
              </div>
              <div className="flex justify-between border-t pt-2 text-lg font-bold"><dt>Total</dt><dd className="tabular-nums">{money(total)}</dd></div>
            </dl>
            <PaymentFields value={pay} onChange={setPay} total={total} direction="in" accounts={accounts} issueDate={issue} />
          </Panel>

          {error && <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-12 rounded-full font-semibold" disabled={busy !== null} onClick={() => submit(false)}>
              {busy === "quote" ? <Loader2 size={16} className="animate-spin" /> : "Salvar orçamento"}
            </Button>
            <Button type="button" className="h-12 rounded-full font-semibold" disabled={busy !== null} onClick={() => submit(true)}>
              {busy === "confirm" ? <Loader2 size={16} className="animate-spin" /> : "Confirmar venda"}
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">Confirmar baixa o estoque e cria a cobrança. Orçamento não altera nada.</p>
        </div>
      </div>
    </>
  );
}

function blankRow(key: number): Row {
  return { key, product_id: null, name: "", free: false, qty: 1, price: 0, discount: 0, unit: "un", track: false, stock: undefined };
}
