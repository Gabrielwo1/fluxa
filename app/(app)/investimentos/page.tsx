"use client";

import { useMemo } from "react";
import { Landmark } from "lucide-react";
import { useFinance } from "@/components/finance-provider";
import { EmptyConnect, PageTitle, Panel, PanelHeader } from "@/components/ui-kit";
import { brl } from "@/lib/format";

const TYPES: Record<string, string> = {
  FIXED_INCOME: "Renda fixa",
  MUTUAL_FUND: "Fundos",
  EQUITY: "Ações",
  SECURITY: "Títulos",
  ETF: "ETF",
  COE: "COE",
  PENSION: "Previdência",
};

export default function InvestmentsPage() {
  const { ready, itemIds, investments, totalInvested } = useFinance();

  const positions = useMemo(
    () =>
      investments
        .filter((i) => i.balance > 0)
        .sort((a, b) => b.balance - a.balance),
    [investments]
  );

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of positions) {
      map.set(i.type, (map.get(i.type) ?? 0) + i.balance);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [positions]);

  if (!ready) return null;
  if (itemIds.length === 0) return <EmptyConnect />;

  return (
    <>
      <PageTitle
        title="Investimentos"
        subtitle={`${positions.length} ${positions.length === 1 ? "posição" : "posições"} com saldo`}
      />
      <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Panel>
          <p className="text-sm text-muted-foreground">Total investido</p>
          <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight">
            {brl.format(totalInvested)}
          </p>
          <div className="mt-5 space-y-3">
            {byType.map(([type, v]) => (
              <div key={type}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{TYPES[type] ?? type}</span>
                  <span className="font-semibold tabular-nums">
                    {totalInvested > 0 ? Math.round((v / totalInvested) * 100) : 0}%
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${totalInvested > 0 ? (v / totalInvested) * 100 : 0}%`,
                      background: "var(--ramp-3)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Posições" subtitle="ordenadas por saldo" />
          {positions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum investimento encontrado nas contas conectadas.
            </p>
          ) : (
            <div className="divide-y">
              {positions.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-500">
                      <Landmark size={16} strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{inv.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {TYPES[inv.type] ?? inv.type}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {brl.format(inv.balance)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
