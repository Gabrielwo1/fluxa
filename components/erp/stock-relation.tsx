"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ClipboardCheck, PackageSearch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { call, useApi } from "@/lib/erp/client";
import { qtyFmt } from "@/lib/erp/format";
import type { Channel, Relation, RelationRow, RelationStatus } from "@/lib/erp/services/stock-relation";
import { Chips, EmptyState, ErrorNote, Field, FormDialog, Kpi, LoadingRows, NumberField, SearchBox, Tag, useDebounced } from "@/components/erp/ui";
import { DataTable, type Column } from "@/components/erp/data-table";

const CHANNEL: Record<Channel, { label: string; color: string }> = {
  mercadolivre: { label: "Mercado Livre", color: "var(--c-fixed)" },
  loja: { label: "Loja virtual", color: "var(--c-total)" },
  whatsapp: { label: "WhatsApp", color: "var(--c-income)" },
  balcao: { label: "Balcão", color: "var(--c-card)" },
};
const CHANNELS = Object.keys(CHANNEL) as Channel[];

const STATUS: Record<RelationStatus, { label: string; tone: "neutral" | "good" | "bad" | "warn" | "info"; hint: string }> = {
  sem_controle: { label: "Sem controle", tone: "neutral", hint: "O Fluxa ainda não controla o saldo deste produto. Clique em Controlar e informe quanto tem hoje." },
  negativo: { label: "Contagem velha", tone: "bad", hint: "Saiu mais do que a contagem tinha. Refaça a contagem em Ajustar." },
  zerado: { label: "Zerado", tone: "bad", hint: "Sem saldo." },
  repor: { label: "Repor", tone: "warn", hint: "Acaba em até 7 dias no ritmo atual, ou está abaixo do mínimo." },
  sem_giro: { label: "Parado", tone: "info", hint: "Tem saldo e não vendeu no período." },
  ok: { label: "Em dia", tone: "good", hint: "Saldo suficiente para o ritmo atual." },
};

type Filter = "all" | "act" | "none" | "idle";
const FILTERS: Record<Filter, (r: RelationRow) => boolean> = {
  all: () => true,
  act: (r) => ["repor", "zerado", "negativo"].includes(r.status),
  none: (r) => r.status === "sem_controle",
  idle: (r) => r.status === "sem_giro",
};

export function StockRelation() {
  const [days, setDays] = useState<"7" | "30" | "90" | "180">("30");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [tracking, setTracking] = useState<RelationRow | null>(null);
  const { data, error, loading, reload } = useApi<Relation>(`/api/erp/stock/relation?days=${days}`);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => FILTERS[filter](r) && (!term || r.name.toLowerCase().includes(term) || r.sku.toLowerCase().includes(term)));
  }, [data, filter, q]);

  const all = data?.rows ?? [];
  const sold = all.reduce((s, r) => s + r.sold_period, 0);
  const toAct = all.filter(FILTERS.act).length;
  const untracked = all.filter(FILTERS.none).length;
  const maxSold = Math.max(1, ...all.map((r) => r.sold_period));

  const columns: Column<RelationRow>[] = [
    { key: "name", header: "Produto", cell: (r) => <div className="min-w-0"><p className="max-w-xs truncate font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.sku || "sem SKU"}{r.last_sale ? ` · última venda ${r.last_sale.split("-").reverse().slice(0, 2).join("/")}` : ""}</p></div> },
    { key: "sold", header: `Vendido (${days} dias)`, cell: (r) => <SoldBar row={r} max={maxSold} /> },
    { key: "perday", header: "Por dia", align: "right", cell: (r) => (r.per_day ? qtyFmt(r.per_day) : "—") },
    { key: "stock", header: "Estoque", align: "right", cell: (r) => (r.stock === null ? <span className="text-muted-foreground">—</span> : <span className={`font-semibold ${r.stock <= 0 ? "text-bad" : ""}`}>{qtyFmt(r.stock)} {r.unit}</span>) },
    { key: "cover", header: "Dura", align: "right", cell: (r) => (r.cover_days === null ? "—" : r.cover_days > 365 ? "+1 ano" : `${r.cover_days} dia(s)`) },
    { key: "buy", header: "Comprar p/ 30 dias", align: "right", cell: (r) => (r.suggested > 0 ? <span className="font-semibold">{qtyFmt(r.suggested)}</span> : "—") },
    { key: "status", header: "Situação", cell: (r) => <span title={STATUS[r.status].hint}><Tag tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Tag></span> },
    { key: "act", header: "", align: "right", cell: (r) => (r.status === "sem_controle" ? <Button size="sm" variant="outline" className="rounded-full" onClick={() => setTracking(r)}><ClipboardCheck size={14} /> Controlar</Button> : null) },
  ];

  return (
    <>
      {error && <ErrorNote message={error} onRetry={reload} />}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={`Unidades vendidas (${days} dias)`} value={qtyFmt(sold)} sub={`${all.filter((r) => r.sold_period > 0).length} produto(s) com venda`} />
        <Kpi label="Para repor" value={String(toAct)} tone={toAct ? "warn" : undefined} sub={toAct ? "Acabam logo, zerados ou com contagem velha" : "Nada urgente"} />
        <Kpi label="Sem controle de estoque" value={String(untracked)} tone={untracked ? "warn" : undefined} hint="Produtos que vendem mas o Fluxa não sabe quanto têm. Informe a contagem de hoje." />
        <Kpi label="Parados" value={String(all.filter(FILTERS.idle).length)} sub="Com saldo e sem venda no período" />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBox value={search} onChange={setSearch} placeholder="Buscar produto ou SKU…" className="w-full sm:max-w-xs sm:flex-1" />
        <Chips label="Período" value={days} onChange={setDays} options={[{ value: "7", label: "7 dias" }, { value: "30", label: "30 dias" }, { value: "90", label: "90 dias" }, { value: "180", label: "6 meses" }]} />
        <Chips label="Mostrar" value={filter} onChange={setFilter} options={[{ value: "all", label: "Todos" }, { value: "act", label: `Repor (${toAct})` }, { value: "none", label: `Sem controle (${untracked})` }, { value: "idle", label: "Parados" }]} />
      </div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {CHANNELS.map((c) => <li key={c} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: CHANNEL[c].color }} />{CHANNEL[c].label}</li>)}
      </ul>
      {loading && !data ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <EmptyState icon={PackageSearch} title="Nada para mostrar">Ainda não há vendas de produtos neste período, ou o filtro escondeu tudo. Vendas das integrações aparecem aqui sozinhas.</EmptyState>
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          columns={columns}
          mobileCard={(r) => (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="truncate font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.sku || "sem SKU"}</p></div>
                <Tag tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Tag>
              </div>
              <SoldBar row={r} max={maxSold} />
              <p className="text-xs text-muted-foreground">
                {r.per_day ? `${qtyFmt(r.per_day)}/dia` : "sem vendas"} · estoque {r.stock === null ? "—" : qtyFmt(r.stock)}{r.cover_days !== null ? ` · dura ${r.cover_days} dia(s)` : ""}{r.suggested ? ` · comprar ${qtyFmt(r.suggested)}` : ""}
              </p>
              {r.status === "sem_controle" && <Button size="sm" variant="outline" className="rounded-full" onClick={() => setTracking(r)}><ClipboardCheck size={14} /> Controlar</Button>}
            </div>
          )}
        />
      )}
      {tracking && <TrackDialog row={tracking} onClose={() => setTracking(null)} onDone={reload} />}
    </>
  );
}

// Barra do vendido no período, dividida por canal: o comprimento é relativo ao produto que mais vendeu.
function SoldBar({ row, max }: { row: RelationRow; max: number }) {
  const width = (row.sold_period / max) * 100;
  return (
    <div className="min-w-36">
      <p className="mb-1 text-sm font-semibold tabular-nums">{qtyFmt(row.sold_period)} <span className="text-xs font-normal text-muted-foreground">de {qtyFmt(row.sold_total)} no total</span></p>
      <div className="h-2 rounded-full bg-muted" role="img" aria-label={CHANNELS.filter((c) => row.by_channel[c] > 0).map((c) => `${CHANNEL[c].label}: ${qtyFmt(row.by_channel[c])}`).join(", ") || "sem vendas no período"}>
        <div className="flex h-full overflow-hidden rounded-full" style={{ width: `${Math.max(row.sold_period > 0 ? 4 : 0, width)}%` }}>
          {CHANNELS.map((c) => row.by_channel[c] > 0 && <span key={c} title={`${CHANNEL[c].label}: ${qtyFmt(row.by_channel[c])}`} style={{ width: `${(row.by_channel[c] / row.sold_period) * 100}%`, background: CHANNEL[c].color }} />)}
        </div>
      </div>
    </div>
  );
}

function TrackDialog({ row, onClose, onDone }: { row: RelationRow; onClose: () => void; onDone: () => void }) {
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await call("POST", "/api/erp/stock/track", { product_id: row.id, count });
      toast.success(`${row.name}: estoque controlado a partir de hoje.`);
      onDone();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title="Controlar estoque" description={row.name} onSubmit={save} busy={busy} error={error}>
      <Field label={`Quanto tem hoje (${row.unit})`} required>
        <NumberField value={count} onChange={setCount} suffix={row.unit} />
      </Field>
      <p className="flex gap-2 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        Conte a prateleira. A partir de hoje, cada venda (Mercado Livre, loja, WhatsApp ou balcão) baixa daqui sozinha. Vendas de dias anteriores, que ainda estão chegando do histórico, não baixam: já estão na contagem.
      </p>
    </FormDialog>
  );
}
