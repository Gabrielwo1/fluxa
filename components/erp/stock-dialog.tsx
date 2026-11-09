"use client";

import { useState } from "react";
import { toast } from "sonner";
import { call } from "@/lib/erp/client";
import type { Product } from "@/lib/erp/types";
import { qtyFmt } from "@/lib/erp/format";
import { Field, FormDialog, MoneyInput, NumberField, SelectField, TextInput } from "@/components/erp/ui";
import { ProductPicker } from "@/components/erp/entity-picker";

type Mode = "in" | "out" | "count";

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: "in", label: "Entrada", hint: "Chegou mercadoria ou sobrou algo" },
  { value: "out", label: "Saída", hint: "Perda, quebra, uso interno" },
  { value: "count", label: "Contagem", hint: "Contei na prateleira e quero acertar" },
];

// Ajuste de estoque feito à mão: entrada, saída ou contagem (inventário).
export function StockDialog({
  open,
  onOpenChange,
  product,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product?: Product | null;
  onDone: () => void;
}) {
  return open ? <Inner key={product?.id ?? "any"} onOpenChange={onOpenChange} product={product} onDone={onDone} /> : null;
}

function Inner({ onOpenChange, product, onDone }: { onOpenChange: (o: boolean) => void; product?: Product | null; onDone: () => void }) {
  const [picked, setPicked] = useState<Product | null>(product ?? null);
  const [mode, setMode] = useState<Mode>("in");
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState("adjust");
  const [cost, setCost] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = picked?.stock ?? 0;
  const after = mode === "count" ? qty : mode === "in" ? current + qty : current - qty;

  async function save() {
    setError(null);
    if (!picked) return setError("Escolha o produto.");
    if (mode !== "count" && qty <= 0) return setError("Informe a quantidade.");
    setBusy(true);
    try {
      await call("POST", "/api/erp/stock", {
        product_id: picked.id,
        mode,
        qty,
        reason: mode === "in" ? (reason === "loss" ? "adjust" : reason) : mode === "out" ? reason : "adjust",
        unit_cost: mode === "in" && cost > 0 ? cost : undefined,
        note,
      });
      toast.success("Estoque atualizado.");
      onDone();
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog open onOpenChange={onOpenChange} title="Ajustar estoque" description="Cada ajuste fica registrado no histórico, com o motivo." onSubmit={save} busy={busy} error={error}>
      <Field label="Produto" required>
        <ProductPicker
          value={picked?.id ?? null}
          label={picked?.name}
          onChange={(p) => {
            setPicked(p);
            if (p && !cost) setCost(p.cost_price);
          }}
        />
      </Field>
      {picked && !picked.track_stock && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">Este item não controla estoque. Ative o controle no cadastro do produto.</p>}
      <div role="radiogroup" aria-label="Tipo de ajuste" className="grid grid-cols-3 gap-2">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={mode === m.value}
            onClick={() => {
              setMode(m.value);
              setReason(m.value === "out" ? "loss" : "adjust");
            }}
            className={`rounded-xl border p-2.5 text-left transition-colors ${mode === m.value ? "border-primary bg-primary/15" : "hover:bg-muted"}`}
          >
            <span className="block text-sm font-semibold">{m.label}</span>
            <span className="block text-[11px] leading-tight text-muted-foreground">{m.hint}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={mode === "count" ? "Quantidade contada" : "Quantidade"} required>
          <NumberField value={qty} onChange={setQty} suffix={picked?.unit} />
        </Field>
        {mode === "out" && (
          <Field label="Motivo">
            <SelectField value={reason} onChange={setReason} options={[{ value: "loss", label: "Perda ou quebra" }, { value: "adjust", label: "Uso interno / outro" }, { value: "return", label: "Devolução ao fornecedor" }]} />
          </Field>
        )}
        {mode === "in" && (
          <Field label="Custo unitário" hint="Opcional. Atualiza o custo do produto.">
            <MoneyInput value={cost} onChange={setCost} />
          </Field>
        )}
      </div>
      <Field label="Observação">
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: contagem de outubro" />
      </Field>
      {picked && picked.track_stock && (
        <p className="rounded-xl bg-muted px-3 py-2 text-sm">
          Hoje: <strong>{qtyFmt(current)} {picked.unit}</strong> → depois: <strong className={after < 0 ? "text-bad" : undefined}>{qtyFmt(after)} {picked.unit}</strong>
        </p>
      )}
    </FormDialog>
  );
}
