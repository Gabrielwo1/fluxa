"use client";

import { useState } from "react";
import { ChevronsUpDown, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useApi, qs } from "@/lib/erp/client";
import type { Party, Product } from "@/lib/erp/types";
import { money, qtyFmt } from "@/lib/erp/format";
import { cn } from "@/lib/utils";
import { LoadingRows, useDebounced, useFieldId } from "@/components/erp/ui";
import { PartyFormSheet } from "@/components/erp/party-form";

function Shell({
  label,
  placeholder,
  open,
  setOpen,
  onClear,
  children,
  search,
  setSearch,
  footer,
}: {
  label: string | null;
  placeholder: string;
  open: boolean;
  setOpen: (o: boolean) => void;
  onClear?: () => void;
  children: React.ReactNode;
  search: string;
  setSearch: (v: string) => void;
  footer?: React.ReactNode;
}) {
  const id = useFieldId();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger
          id={id}
          type="button"
          className={cn(
            "flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-input bg-transparent px-3 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
            !label && "text-muted-foreground"
          )}
        >
          <span className="truncate">{label ?? placeholder}</span>
          <ChevronsUpDown size={15} className="shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        {label && onClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Limpar"
            className="absolute right-9 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <PopoverContent align="start" className="w-[min(26rem,calc(100vw-2rem))] gap-2 p-2">
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Digite para buscar…"
          className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
        />
        <div className="max-h-64 overflow-y-auto">{children}</div>
        {footer}
      </PopoverContent>
    </Popover>
  );
}

// Escolhe um cliente (ou fornecedor) buscando pelo nome, e permite cadastrar um novo ali mesmo.
export function PartyPicker({
  kind,
  value,
  label,
  onChange,
  placeholder,
  allowClear = true,
}: {
  kind: "customer" | "supplier";
  value: string | null;
  label?: string | null;
  onChange: (party: Party | null) => void;
  placeholder?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const debounced = useDebounced(search);
  const { data, loading } = useApi<{ parties: Party[] }>(open ? `/api/erp/parties${qs({ kind, q: debounced, status: "all", limit: 30 })}` : null);
  const shown = value ? (picked ?? label ?? "Selecionado") : null;
  const noun = kind === "customer" ? "cliente" : "fornecedor";

  return (
    <>
      <Shell
        label={shown}
        placeholder={placeholder ?? `Escolher ${noun}…`}
        open={open}
        setOpen={setOpen}
        onClear={allowClear ? () => { setPicked(null); onChange(null); } : undefined}
        search={search}
        setSearch={setSearch}
        footer={
          <button
            type="button"
            onClick={() => { setOpen(false); setCreating(true); }}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary-foreground/90 hover:bg-muted"
          >
            <Plus size={15} /> Cadastrar novo {noun}
          </button>
        }
      >
        {loading && !data ? (
          <LoadingRows rows={3} />
        ) : data && data.parties.length > 0 ? (
          data.parties.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { setPicked(p.name); onChange(p); setOpen(false); }}
              className={cn("flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-muted", p.id === value && "bg-muted")}
            >
              <span className="text-sm font-medium">{p.name}</span>
              {(p.phone || p.city) && <span className="text-xs text-muted-foreground">{[p.phone, p.city].filter(Boolean).join(" · ")}</span>}
            </button>
          ))
        ) : (
          <p className="px-3 py-4 text-center text-sm text-muted-foreground">Nenhum {noun} encontrado.</p>
        )}
      </Shell>
      <PartyFormSheet
        open={creating}
        onOpenChange={setCreating}
        role={kind}
        onSaved={(p) => { setPicked(p.name); onChange(p); }}
      />
    </>
  );
}

// Escolhe um produto ou serviço do catálogo, mostrando preço e estoque.
export function ProductPicker({
  value,
  label,
  onChange,
  placeholder = "Buscar produto ou serviço…",
  priceField = "sale_price",
}: {
  value: string | null;
  label?: string | null;
  onChange: (p: Product | null) => void;
  placeholder?: string;
  priceField?: "sale_price" | "cost_price";
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const { data, loading } = useApi<{ products: Product[] }>(open ? `/api/erp/products${qs({ q: debounced, active: "true", limit: 30 })}` : null);
  return (
    <Shell
      label={value ? (label ?? "Selecionado") : null}
      placeholder={placeholder}
      open={open}
      setOpen={setOpen}
      onClear={() => onChange(null)}
      search={search}
      setSearch={setSearch}
    >
      {loading && !data ? (
        <LoadingRows rows={3} />
      ) : data && data.products.length > 0 ? (
        data.products.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => { onChange(p); setOpen(false); }}
            className={cn("flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted", p.id === value && "bg-muted")}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{p.name}</span>
              <span className="block text-xs text-muted-foreground">
                {p.kind === "service" ? "Serviço" : p.track_stock ? `Estoque: ${qtyFmt(p.stock ?? 0)} ${p.unit}` : "Sem controle de estoque"}
                {p.sku ? ` · ${p.sku}` : ""}
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">{money(p[priceField])}</span>
          </button>
        ))
      ) : (
        <p className="px-3 py-4 text-center text-sm text-muted-foreground">Nenhum item encontrado. Cadastre em Produtos e serviços.</p>
      )}
    </Shell>
  );
}
