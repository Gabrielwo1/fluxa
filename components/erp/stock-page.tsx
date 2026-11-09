"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Boxes, Plus } from "lucide-react";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { qs, useApi } from "@/lib/erp/client";
import type { Product, StockMove } from "@/lib/erp/types";
import { fmtDate, money, qtyFmt } from "@/lib/erp/format";
import { Chips, EmptyState, ErrorNote, Kpi, LoadingRows, PageHeader, SearchBox, Tag, useDebounced } from "@/components/erp/ui";
import { DataTable, type Column } from "@/components/erp/data-table";
import { StockDialog } from "@/components/erp/stock-dialog";
import { ErpGate } from "@/components/erp/gate";

const REASONS: Record<string, string> = {
  initial: "Estoque inicial",
  purchase: "Compra",
  sale: "Venda",
  adjust: "Ajuste",
  loss: "Perda",
  return: "Devolução",
  sale_cancel: "Venda cancelada",
  purchase_cancel: "Compra cancelada",
};

export function StockPage() {
  return <ErpGate>{() => <Inner />}</ErpGate>;
}

function Inner() {
  const [tab, setTab] = useState<"balance" | "moves">("balance");
  const [q, setQ] = useState("");
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(q);
  const products = useApi<{ products: Product[] }>(`/api/erp/products${qs({ q: debounced, kind: "product", active: "true" })}`);
  const moves = useApi<{ moves: StockMove[] }>(tab === "moves" ? "/api/erp/stock?limit=300" : null);

  const tracked = (products.data?.products ?? []).filter((p) => p.track_stock);
  const low = tracked.filter((p) => (p.stock ?? 0) <= p.min_stock);
  const total = tracked.reduce((s, p) => s + Math.max(p.stock ?? 0, 0) * p.cost_price, 0);

  const balanceCols: Column<Product>[] = [
    { key: "name", header: "Produto", cell: (p) => <div className="min-w-0"><p className="truncate font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.sku || p.category || ""}</p></div> },
    { key: "stock", header: "Saldo", align: "right", cell: (p) => <span className="font-semibold">{qtyFmt(p.stock ?? 0)} {p.unit}</span> },
    { key: "min", header: "Mínimo", align: "right", cell: (p) => `${qtyFmt(p.min_stock)} ${p.unit}` },
    { key: "cost", header: "Custo", align: "right", cell: (p) => money(p.cost_price) },
    { key: "value", header: "Valor", align: "right", cell: (p) => money(Math.max(p.stock ?? 0, 0) * p.cost_price) },
    {
      key: "status",
      header: "Situação",
      cell: (p) => ((p.stock ?? 0) <= 0 ? <Tag tone="bad">Zerado</Tag> : (p.stock ?? 0) <= p.min_stock ? <Tag tone="warn">Baixo</Tag> : <Tag tone="good">OK</Tag>),
    },
    { key: "act", header: "", align: "right", cell: (p) => <Button size="sm" variant="outline" className="rounded-full" onClick={(e) => { e.stopPropagation(); setAdjusting(p); setOpen(true); }}>Ajustar</Button> },
  ];

  const moveCols: Column<StockMove>[] = [
    { key: "date", header: "Data", cell: (m) => fmtDate(m.created_at) },
    { key: "product", header: "Produto", cell: (m) => <span className="font-medium">{m.product_name}</span> },
    { key: "reason", header: "Motivo", cell: (m) => <span>{REASONS[m.reason] ?? m.reason}{m.note ? <span className="block text-xs text-muted-foreground">{m.note}</span> : null}</span> },
    { key: "qty", header: "Quantidade", align: "right", cell: (m) => <span className={m.qty > 0 ? "font-semibold text-good" : "font-semibold text-bad"}>{m.qty > 0 ? "+" : ""}{qtyFmt(m.qty)} {m.unit}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Estoque"
        description="Quanto você tem de cada produto, e tudo o que entrou e saiu."
        help={
          <>
            <p>O estoque se mexe sozinho: <strong>venda confirmada</strong> baixa, <strong>compra recebida</strong> soma. Cancelar devolve.</p>
            <p>Use <strong>Ajustar</strong> só para o que não vem de venda ou compra: perda, quebra, contagem na prateleira.</p>
          </>
        }
        actions={<Button className="rounded-full font-semibold" onClick={() => { setAdjusting(null); setOpen(true); }}><Plus size={16} /> Ajustar estoque</Button>}
      />
      {products.error && <ErrorNote message={products.error} onRetry={products.reload} />}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Produtos controlados" value={String(tracked.length)} />
        <Kpi label="Valor em estoque" value={money(total)} hint="Saldo de cada produto vezes o custo atual." />
        <Kpi label="Abaixo do mínimo" value={String(low.length)} tone={low.length ? "warn" : undefined} sub={low.length ? "Precisam de reposição" : "Nada em falta"} />
        <Kpi label="Zerados" value={String(tracked.filter((p) => (p.stock ?? 0) <= 0).length)} tone={tracked.some((p) => (p.stock ?? 0) <= 0) ? "bad" : undefined} />
      </div>
      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Chips label="Visão" value={tab} onChange={setTab} options={[{ value: "balance", label: "Saldo atual" }, { value: "moves", label: "Movimentações" }]} />
          {tab === "balance" && <SearchBox value={q} onChange={setQ} placeholder="Buscar produto…" className="w-full sm:max-w-xs sm:flex-1" />}
        </div>
        {tab === "balance" ? (
          products.loading && !products.data ? (
            <LoadingRows />
          ) : tracked.length === 0 ? (
            <EmptyState icon={Boxes} title="Nenhum produto com estoque controlado">Ao cadastrar um produto, deixe “Controlar estoque” ligado e informe quanto tem hoje.</EmptyState>
          ) : (
            <DataTable
              rows={tracked}
              rowKey={(p) => p.id}
              columns={balanceCols}
              mobileCard={(p) => (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0"><p className="truncate font-medium">{p.name}</p><p className="text-xs text-muted-foreground">mín. {qtyFmt(p.min_stock)} · {money(Math.max(p.stock ?? 0, 0) * p.cost_price)}</p></div>
                  <button className="text-right" onClick={() => { setAdjusting(p); setOpen(true); }}>
                    <span className={`block text-lg font-bold tabular-nums ${(p.stock ?? 0) <= 0 ? "text-bad" : (p.stock ?? 0) <= p.min_stock ? "text-[var(--c-fixed)]" : ""}`}>{qtyFmt(p.stock ?? 0)}</span>
                    <span className="block text-xs text-muted-foreground">{p.unit} · ajustar</span>
                  </button>
                </div>
              )}
            />
          )
        ) : moves.loading && !moves.data ? (
          <LoadingRows />
        ) : (moves.data?.moves ?? []).length === 0 ? (
          <EmptyState icon={Boxes} title="Ainda não há movimentações">Elas aparecem aqui quando você vender, comprar ou ajustar o estoque.</EmptyState>
        ) : (
          <DataTable
            rows={moves.data!.moves}
            rowKey={(m) => m.id}
            columns={moveCols}
            mobileCard={(m) => (
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${m.qty > 0 ? "bg-good/15 text-good" : "bg-bad/15 text-bad"}`}>
                    {m.qty > 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                  </span>
                  <div className="min-w-0"><p className="truncate font-medium">{m.product_name}</p><p className="text-xs text-muted-foreground">{REASONS[m.reason]} · {fmtDate(m.created_at)}</p></div>
                </div>
                <span className={`font-semibold tabular-nums ${m.qty > 0 ? "text-good" : "text-bad"}`}>{m.qty > 0 ? "+" : ""}{qtyFmt(m.qty)}</span>
              </div>
            )}
          />
        )}
      </Panel>
      <StockDialog open={open} onOpenChange={setOpen} product={adjusting} onDone={() => { products.reload(); moves.reload(); }} />
    </>
  );
}
