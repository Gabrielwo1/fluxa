"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { call } from "@/lib/erp/client";
import type { Product } from "@/lib/erp/types";
import { money } from "@/lib/erp/format";
import { Field, FormSheet, MoneyInput, NumberField, SelectField, TextArea, TextInput, Toggle } from "@/components/erp/ui";

type Form = {
  kind: "product" | "service";
  name: string;
  sku: string;
  unit: string;
  category: string;
  cost_price: number;
  sale_price: number;
  track_stock: boolean;
  initial_stock: number;
  min_stock: number;
  active: boolean;
  notes: string;
};

const UNITS = ["un", "kg", "g", "l", "ml", "m", "cx", "pç", "h", "serv"];

const blank = (): Form => ({
  kind: "product",
  name: "",
  sku: "",
  unit: "un",
  category: "",
  cost_price: 0,
  sale_price: 0,
  track_stock: true,
  initial_stock: 0,
  min_stock: 0,
  active: true,
  notes: "",
});

export function ProductFormSheet({
  open,
  onOpenChange,
  product,
  categories,
  onSaved,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product?: Product | null;
  categories: string[];
  onSaved: (p: Product) => void;
  onDelete?: (p: Product) => void;
}) {
  return open ? <Inner key={product?.id ?? "new"} onOpenChange={onOpenChange} product={product} categories={categories} onSaved={onSaved} onDelete={onDelete} /> : null;
}

function Inner({
  onOpenChange,
  product,
  categories,
  onSaved,
  onDelete,
}: {
  onOpenChange: (o: boolean) => void;
  product?: Product | null;
  categories: string[];
  onSaved: (p: Product) => void;
  onDelete?: (p: Product) => void;
}) {
  const [f, setF] = useState<Form>(() =>
    product
      ? { kind: product.kind, name: product.name, sku: product.sku, unit: product.unit, category: product.category, cost_price: product.cost_price, sale_price: product.sale_price, track_stock: product.track_stock, initial_stock: 0, min_stock: product.min_stock, active: product.active, notes: product.notes }
      : blank()
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));
  const isService = f.kind === "service";
  const profit = f.sale_price - f.cost_price;
  const margin = f.sale_price > 0 ? (profit / f.sale_price) * 100 : 0;

  async function save() {
    setError(null);
    if (!f.name.trim()) return setError("Informe o nome.");
    setBusy(true);
    try {
      const saved = product
        ? await call<Product>("PUT", `/api/erp/products/${product.id}`, f)
        : await call<Product>("POST", "/api/erp/products", f);
      toast.success(product ? "Produto atualizado." : "Produto cadastrado.");
      onSaved(saved);
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
      title={product ? "Editar produto ou serviço" : "Novo produto ou serviço"}
      description="Tudo o que você vende fica aqui. Serviços não têm estoque."
      onSubmit={save}
      busy={busy}
      error={error}
      extraActions={
        product && onDelete ? (
          <Button type="button" variant="ghost" className="mr-auto rounded-full text-destructive hover:text-destructive" onClick={() => onDelete(product)}>
            Excluir
          </Button>
        ) : undefined
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["product", "Produto", "Coisa que você guarda e entrega"],
            ["service", "Serviço", "Hora de trabalho, instalação, consultoria"],
          ] as const
        ).map(([value, label, hint]) => (
          <button
            key={value}
            type="button"
            onClick={() => setF((s) => ({ ...s, kind: value, track_stock: value === "product" }))}
            aria-pressed={f.kind === value}
            className={`rounded-xl border p-3 text-left transition-colors ${f.kind === value ? "border-primary bg-primary/15" : "hover:bg-muted"}`}
          >
            <span className="block text-sm font-semibold">{label}</span>
            <span className="block text-xs text-muted-foreground">{hint}</span>
          </button>
        ))}
      </div>

      <Field label="Nome" required>
        <TextInput value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus placeholder={isService ? "Ex.: Manutenção de computador" : "Ex.: Caderno universitário"} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Código (SKU)" hint="Opcional. Ajuda a achar rápido.">
          <TextInput value={f.sku} onChange={(e) => set("sku", e.target.value)} />
        </Field>
        <Field label="Unidade de medida">
          <SelectField value={f.unit} onChange={(v) => set("unit", v)} options={UNITS.map((u) => ({ value: u, label: u }))} />
        </Field>
      </div>

      <Field label="Categoria" hint="Agrupa nos relatórios. Escreva ou escolha uma que já existe.">
        <TextInput value={f.category} onChange={(e) => set("category", e.target.value)} list="categorias-produto" />
        <datalist id="categorias-produto">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={isService ? "Custo (opcional)" : "Quanto custa para você"} hint={isService ? "Material ou repasse, se houver." : "Preço que você paga."}>
          <MoneyInput value={f.cost_price} onChange={(n) => set("cost_price", n)} />
        </Field>
        <Field label="Preço de venda" required>
          <MoneyInput value={f.sale_price} onChange={(n) => set("sale_price", n)} />
        </Field>
      </div>
      {f.sale_price > 0 && (
        <p className="rounded-xl bg-muted px-3 py-2 text-sm">
          Em cada venda sobra <strong className={profit >= 0 ? "text-good" : "text-bad"}>{money(profit)}</strong>
          {f.cost_price > 0 && <> — margem de <strong>{margin.toFixed(1).replace(".", ",")}%</strong></>}.
        </p>
      )}

      {!isService && (
        <div className="space-y-3 rounded-2xl border p-4">
          <Toggle checked={f.track_stock} onChange={(v) => set("track_stock", v)} label="Controlar estoque" hint="O sistema desconta a cada venda e soma a cada compra." />
          {f.track_stock && (
            <div className="grid grid-cols-2 gap-3">
              {!product && (
                <Field label="Quanto tem hoje" hint="Quantidade que já está na prateleira.">
                  <NumberField value={f.initial_stock} onChange={(n) => set("initial_stock", n)} suffix={f.unit} />
                </Field>
              )}
              <Field label="Avisar quando chegar em" hint="Estoque mínimo.">
                <NumberField value={f.min_stock} onChange={(n) => set("min_stock", n)} suffix={f.unit} />
              </Field>
            </div>
          )}
          {product && f.track_stock && <p className="text-xs text-muted-foreground">Para mudar a quantidade, use Estoque → Ajustar. Assim fica registrado o motivo.</p>}
        </div>
      )}

      <Toggle checked={f.active} onChange={(v) => set("active", v)} label="Ativo" hint="Inativos não aparecem na hora de vender, mas o histórico fica." />
      <Field label="Observações">
        <TextArea value={f.notes} onChange={(v) => set("notes", v)} />
      </Field>
    </FormSheet>
  );
}
