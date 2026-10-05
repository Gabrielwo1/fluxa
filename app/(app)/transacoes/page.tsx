"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useFinance } from "@/components/finance-provider";
import { EmptyConnect, PageTitle, Panel } from "@/components/ui-kit";
import { MonthNav } from "@/components/month-nav";
import { TxRow } from "@/components/tx-row";
import { translateCategory } from "@/lib/categories";
import { brl, monthLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

type Filter = "all" | "income" | "expense" | "invest";

const FILTERS: [Filter, string][] = [
  ["all", "Todas"],
  ["income", "Entradas"],
  ["expense", "Despesas"],
  ["invest", "Investimentos"],
];

function TransactionsView() {
  const { ready, itemIds, monthTxs, flowOf, selectedMonth, cur } = useFinance();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(100);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return monthTxs.filter((t) => {
      const kind = flowOf(t).kind;
      if (filter !== "all" && kind !== filter) return false;
      if (!q) return true;
      return (
        t.description.toLowerCase().includes(q) ||
        translateCategory(t.category).toLowerCase().includes(q)
      );
    });
  }, [monthTxs, flowOf, filter, search]);

  if (!ready) return null;
  if (itemIds.length === 0) return <EmptyConnect />;

  const total = filtered.reduce((s, t) => {
    const f = flowOf(t);
    if (f.kind === "income") return s + f.value;
    if (f.kind === "expense") return s - f.value;
    return s;
  }, 0);

  return (
    <>
      <PageTitle
        title="Transações"
        subtitle={`${monthLabel(selectedMonth)}${cur.future ? " · previsto (parcelas já lançadas)" : ""}`}
        right={<MonthNav />}
      />
      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 basis-64">
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(100);
              }}
              placeholder="Buscar por descrição ou categoria…"
              className="h-10 w-full rounded-full border bg-background pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              aria-label="Buscar transações"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => {
                  setFilter(id);
                  setLimit(100);
                }}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  filter === id
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{filtered.length} lançamentos</span>
          <span className="tabular-nums">
            saldo do filtro:{" "}
            <span className={cn("font-semibold", total >= 0 ? "text-good" : "text-bad")}>
              {total >= 0 ? "▲ +" : "▼ −"}
              {brl.format(Math.abs(total))}
            </span>
          </span>
        </div>

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma transação encontrada.
          </p>
        ) : (
          <div className="divide-y">
            {filtered.slice(0, limit).map((t) => (
              <TxRow key={t.id} tx={t} />
            ))}
          </div>
        )}
        {filtered.length > limit && (
          <button
            onClick={() => setLimit((l) => l + 100)}
            className="mt-3 w-full rounded-xl border py-2 text-sm font-medium hover:bg-muted"
          >
            Mostrar mais ({filtered.length - limit} restantes)
          </button>
        )}
      </Panel>
    </>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={null}>
      <TransactionsView />
    </Suspense>
  );
}
