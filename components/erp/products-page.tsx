"use client";

import { useMemo, useState } from "react";
import { Boxes, Package, Plus } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { call, qs, useApi } from "@/lib/erp/client";
import type { Product } from "@/lib/erp/types";
import { money, qtyFmt } from "@/lib/erp/format";
import { Chips, ConfirmDialog, EmptyState, ErrorNote, Kpi, LoadingRows, PageHeader, SearchBox, Tag, useClearNew, useDebounced } from "@/components/erp/ui";
import { DataTable, type Column } from "@/components/erp/data-table";
import { ProductFormSheet } from "@/components/erp/product-form";
import { StockDialog } from "@/components/erp/stock-dialog";
import { ErpGate } from "@/components/erp/gate";

type Filter = "all" | "product" | "service" | "low" | "inactive";

export function ProductsPage({ novo = false }: { novo?: boolean }) {
  return <ErpGate>{() => <Inner novo={novo} />}</ErpGate>;
}

const stockTag = (p: Product) => {
  if (!p.track_stock) return <span className="text-muted-foreground">—</span>;
  const s = p.stock ?? 0;
  if (s <= 0) return <Tag tone="bad">Zerado</Tag>;
  if (s <= p.min_stock) return <Tag tone="warn">{qtyFmt(s)} {p.unit} · baixo</Tag>;
  return <span className="tabular-nums">{qtyFmt(s)} {p.unit}</span>;
};

function Inner({ novo }: { novo: boolean }) {
  const clearNew = useClearNew(novo);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [formOpen, setFormOpen] = useState(novo);
  const [editing, setEditing] = useState<Product | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [removing, setRemoving] = useState<Product | null>(null);
  const debounced = useDebounced(q);
  const { data, error, loading, reload } = useApi<{ products: Product[] }>(`/api/erp/products${qs({ q: debounced })}`);

  const all = useMemo(() => data?.products ?? [], [data]);
  const categories = useMemo(() => [...new Set(all.map((p) => p.category).filter(Boolean))].sort(), [all]);
  const low = all.filter((p) => p.active && p.track_stock && (p.stock ?? 0) <= p.min_stock);
  const rows = all.filter((p) =>
    filter === "all" ? p.active : filter === "inactive" ? !p.active : filter === "low" ? low.includes(p) : p.active && p.kind === filter
  );
  const stockValue = all.reduce((s, p) => s + (p.track_stock ? Math.max(p.stock ?? 0, 0) * p.cost_price : 0), 0);

  const columns: Column<Product>[] = [
    {
      key: "name",
      header: "Produto ou serviço",
      cell: (p) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{p.name}</p>
          <p className="truncate text-xs text-muted-foreground">{[p.kind === "service" ? "Serviço" : "Produto", p.sku, p.category].filter(Boolean).join(" · ")}</p>
        </div>
      ),
    },
    { key: "price", header: "Preço de venda", align: "right", cell: (p) => money(p.sale_price) },
    { key: "cost", header: "Custo", align: "right", cell: (p) => (p.cost_price ? money(p.cost_price) : "—") },
    {
      key: "margin",
      header: "Margem",
      align: "right",
      cell: (p) => (p.sale_price > 0 && p.cost_price > 0 ? `${(((p.sale_price - p.cost_price) / p.sale_price) * 100).toFixed(0)}%` : "—"),
    },
    { key: "stock", header: "Estoque", align: "right", cell: stockTag },
  ];

  async function remove() {
    if (!removing) return;
    try {
      await call("DELETE", `/api/erp/products/${removing.id}`);
      toast.success("Produto excluído.");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setRemoving(null);
  }

  return (
    <>
      <PageHeader
        title="Produtos e serviços"
        description="O catálogo do que você vende: preço, custo e quanto tem em estoque."
        help={
          <>
            <p>Cadastre uma vez e use em toda venda e compra. O sistema calcula a margem (quanto sobra depois do custo).</p>
            <p>
              <strong>Produto</strong> pode ter estoque controlado. <strong>Serviço</strong> não tem estoque: é só preço.
            </p>
          </>
        }
        actions={
          <>
            <Button variant="outline" className="rounded-full" onClick={() => setAdjusting({} as Product)}>
              <Boxes size={16} /> Ajustar estoque
            </Button>
            <Button className="rounded-full font-semibold" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus size={16} /> Novo
            </Button>
          </>
        }
      />
      {error && <ErrorNote message={error} onRetry={reload} />}

      {all.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Itens ativos" value={String(all.filter((p) => p.active).length)} />
          <Kpi label="Valor em estoque" value={money(stockValue)} hint="Quantidade em estoque vezes o custo de cada produto." />
          <Kpi label="Estoque baixo" value={String(low.length)} tone={low.length ? "warn" : undefined} sub={low.length ? "Hora de repor" : "Tudo em dia"} onClick={low.length ? () => setFilter("low") : undefined} />
          <Kpi label="Serviços" value={String(all.filter((p) => p.active && p.kind === "service").length)} />
        </div>
      )}

      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchBox value={q} onChange={setQ} placeholder="Buscar por nome, código ou categoria…" className="w-full sm:max-w-sm sm:flex-1" />
          <Chips
            label="Filtrar"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Todos" },
              { value: "product", label: "Produtos" },
              { value: "service", label: "Serviços" },
              { value: "low", label: "Estoque baixo", count: low.length },
              { value: "inactive", label: "Inativos" },
            ]}
          />
        </div>
        {loading && !data ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          q || filter !== "all" ? (
            <EmptyState icon={Package} title="Nada encontrado">Tente outra busca ou outro filtro.</EmptyState>
          ) : (
            <EmptyState
              icon={Package}
              title="Cadastre o primeiro produto ou serviço"
              action={<Button className="rounded-full font-semibold" onClick={() => setFormOpen(true)}><Plus size={16} /> Cadastrar</Button>}
            >
              Sem catálogo você não consegue vender com preço e estoque automáticos. Comece pelos itens que mais vendem.
            </EmptyState>
          )
        ) : (
          <DataTable
            rows={rows}
            rowKey={(p) => p.id}
            columns={columns}
            onRowClick={(p) => { setEditing(p); setFormOpen(true); }}
            mobileCard={(p) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.kind === "service" ? "Serviço" : stockLabel(p)}</p>
                </div>
                <span className="font-semibold tabular-nums">{money(p.sale_price)}</span>
              </div>
            )}
          />
        )}
      </Panel>

      <ProductFormSheet open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) { setEditing(null); clearNew(); } }} product={editing} categories={categories} onSaved={() => reload()} onDelete={(p) => { setFormOpen(false); setRemoving(p); }} />
      <StockDialog open={Boolean(adjusting)} onOpenChange={(o) => !o && setAdjusting(null)} product={adjusting?.id ? adjusting : null} onDone={reload} />
      <ConfirmDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)} title={`Excluir "${removing?.name}"?`} danger confirmLabel="Excluir" onConfirm={remove}>
        Só dá para excluir produtos que nunca foram vendidos, comprados ou movimentados. Senão, deixe como inativo.
      </ConfirmDialog>
    </>
  );
}

function stockLabel(p: Product) {
  if (!p.track_stock) return "Sem controle de estoque";
  return `Estoque: ${qtyFmt(p.stock ?? 0)} ${p.unit}`;
}
