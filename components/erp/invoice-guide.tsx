"use client";

import { useRef, useState } from "react";
import { Check, Copy, ExternalLink, FileUp, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { call, useApi } from "@/lib/erp/client";
import type { Invoice, Sale } from "@/lib/erp/types";
import { fmtDate, money, moneyInput, todayIso } from "@/lib/erp/format";
import { EMISSOR_NACIONAL_URL } from "@/lib/erp/mei";
import { formatDocument } from "@/lib/erp/validators";
import { DateField, ErrorNote, Field, FormSheet, LoadingRows, MoneyInput, TextInput } from "@/components/erp/ui";

function CopyRow({ label, value, shown }: { label: string; value: string; shown?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error("Não consegui copiar. Selecione o texto e copie à mão.");
    }
  }
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border bg-background p-3">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 break-words text-sm font-medium">{shown ?? value}</p>
      </div>
      <Button type="button" size="sm" variant="outline" className="shrink-0 rounded-full" onClick={copy}>
        {done ? <Check size={14} /> : <Copy size={14} />} {done ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

// Passo a passo para emitir a nota no portal do governo e trazer o resultado de volta.
// Com saleId, os dados da venda já vêm prontos para copiar e a nota fica ligada a ela.
export function InvoiceGuide({ open, onOpenChange, saleId, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; saleId?: string | null; onDone: () => void }) {
  return open ? <Inner key={saleId ?? "avulsa"} onOpenChange={onOpenChange} saleId={saleId ?? null} onDone={onDone} /> : null;
}

function Inner({ onOpenChange, saleId, onDone }: { onOpenChange: (o: boolean) => void; saleId: string | null; onDone: () => void }) {
  const sale = useApi<Sale>(saleId ? `/api/erp/sales/${saleId}` : null);
  const customer = useApi<{ party: { document: string } }>(sale.data?.customer_id ? `/api/erp/parties/${sale.data.customer_id}` : null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [m, setM] = useState({ number: "", issue_date: todayIso(), amount: 0, customer_name: "", customer_document: "", access_key: "" });

  const s = sale.data;
  const description = (s?.items ?? []).map((i) => i.description).join("; ");
  const doc = customer.data?.party.document ?? "";
  const hasProducts = (s?.items ?? []).some((i) => i.product_kind === "product");
  const already = (s?.invoices ?? []).filter((i) => i.status === "issued");

  async function sendXml(file: File) {
    setError(null);
    setBusy(true);
    try {
      const xml = await file.text();
      const inv = await call<Invoice>("POST", "/api/erp/invoices", { xml, sale_id: saleId });
      toast.success(`Nota ${inv.number} registrada.`);
      onDone();
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function sendManual() {
    setError(null);
    if (!m.number.trim()) return setError("Informe o número da nota.");
    setBusy(true);
    try {
      const inv = await call<Invoice>("POST", "/api/erp/invoices", {
        sale_id: saleId,
        number: m.number,
        issue_date: m.issue_date,
        amount: m.amount || s?.total || 0,
        customer_name: m.customer_name || s?.customer_name || "",
        customer_document: m.customer_document || doc,
        access_key: m.access_key,
        description,
      });
      toast.success(`Nota ${inv.number} registrada.`);
      onDone();
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormSheet
      open
      onOpenChange={onOpenChange}
      title={s ? `Emitir nota da venda #${s.number}` : "Registrar nota fiscal"}
      description="Você emite no portal do governo, com a sua conta gov.br. Depois traz a nota para cá, e o sistema guarda e acompanha."
      onSubmit={manual ? sendManual : () => fileRef.current?.click()}
      submitLabel={manual ? "Registrar nota" : "Escolher XML da nota"}
      busy={busy}
      error={error}
    >
      {saleId && !s && !sale.error && <LoadingRows rows={3} />}
      {sale.error && <ErrorNote message={sale.error} />}

      {already.length > 0 && (
        <p className="flex items-start gap-2 rounded-2xl bg-primary/15 px-3 py-2 text-sm"><Info size={15} className="mt-0.5 shrink-0" /> Esta venda já tem a nota {already.map((i) => i.number).join(", ")}. Só registre outra se for uma nota nova.</p>
      )}
      {hasProducts && (
        <p className="flex items-start gap-2 rounded-2xl bg-[var(--c-fixed)]/15 px-3 py-2 text-sm"><Info size={15} className="mt-0.5 shrink-0" /> Esta venda tem produtos. A nota de serviço (NFS-e) vale só para a parte de serviços; venda de produto usa outro tipo de nota.</p>
      )}

      {s && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">1. Copie os dados da venda</h3>
          <CopyRow label="Cliente (tomador)" value={s.customer_name ?? "Consumidor"} />
          {doc && <CopyRow label="CPF/CNPJ do cliente" value={doc} shown={formatDocument(doc)} />}
          <CopyRow label="Valor do serviço" value={moneyInput(s.total)} shown={money(s.total)} />
          <CopyRow label="Descrição do serviço" value={description} />
          <CopyRow label="Data" value={fmtDate(s.issue_date)} />
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{s ? "2. Emita no portal" : "1. Emita no portal"}</h3>
        <p className="text-sm text-muted-foreground">Entre com a sua conta gov.br, escolha <strong>Nova NFS-e</strong>, preencha com os dados e emita. No final, baixe o <strong>XML</strong> da nota.</p>
        <Button type="button" variant="outline" className="rounded-full" render={<a href={EMISSOR_NACIONAL_URL} target="_blank" rel="noreferrer" />}>
          <ExternalLink size={15} /> Abrir o Emissor Nacional
        </Button>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">{s ? "3. Traga a nota para cá" : "2. Traga a nota para cá"}</h3>
        <input ref={fileRef} type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendXml(f); }} />
        {!manual ? (
          <>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-5 text-center transition-colors hover:border-primary hover:bg-primary/10">
              {busy ? <Loader2 size={20} className="animate-spin" /> : <FileUp size={20} />}
              <span className="text-sm font-semibold">Enviar o XML da nota</span>
              <span className="text-xs text-muted-foreground">O sistema lê número, valor, cliente e chave sozinho.</span>
            </button>
            <button type="button" onClick={() => setManual(true)} className="text-sm text-muted-foreground underline-offset-2 hover:underline">Não tenho o XML, registrar à mão</button>
          </>
        ) : (
          <div className="space-y-3 rounded-2xl border p-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Número da nota" required><TextInput value={m.number} onChange={(e) => setM({ ...m, number: e.target.value })} /></Field>
              <Field label="Data de emissão"><DateField value={m.issue_date} onChange={(v) => setM({ ...m, issue_date: v })} /></Field>
            </div>
            <Field label="Valor"><MoneyInput value={m.amount || s?.total || 0} onChange={(n) => setM({ ...m, amount: n })} /></Field>
            {!s && <Field label="Cliente"><TextInput value={m.customer_name} onChange={(e) => setM({ ...m, customer_name: e.target.value })} /></Field>}
            <Field label="Chave de acesso (opcional)" hint="44 a 50 números. Evita registrar a mesma nota duas vezes."><TextInput value={m.access_key} onChange={(e) => setM({ ...m, access_key: e.target.value })} inputMode="numeric" /></Field>
            <button type="button" onClick={() => setManual(false)} className="text-sm text-muted-foreground underline-offset-2 hover:underline">Voltar para enviar o XML</button>
          </div>
        )}
      </section>
    </FormSheet>
  );
}
