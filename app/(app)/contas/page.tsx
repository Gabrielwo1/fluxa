"use client";

import { X } from "lucide-react";
import { useFinance } from "@/components/finance-provider";
import { EmptyConnect, PageTitle, Panel, PanelHeader } from "@/components/ui-kit";
import { AccountCardVisual } from "@/components/dashboard/rail";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";

export default function AccountsPage() {
  const {
    ready,
    itemIds,
    accounts,
    totalBalance,
    totalCredit,
    totalInvested,
    removeItem,
    startConnect,
    connecting,
  } = useFinance();
  if (!ready) return null;
  if (itemIds.length === 0) return <EmptyConnect />;

  const summary = [
    ["Saldo em conta", totalBalance],
    ["Fatura dos cartões", totalCredit],
    ["Investido", totalInvested],
  ] as const;

  return (
    <>
      <PageTitle
        title="Contas"
        subtitle={`${itemIds.length} ${itemIds.length === 1 ? "conexão" : "conexões"} ativas · o plano gratuito do Meu Pluggy aceita até 5`}
        right={
          <Button className="rounded-full font-semibold" onClick={startConnect} disabled={connecting}>
            {connecting ? "Abrindo…" : "Conectar banco"}
          </Button>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        {summary.map(([label, v]) => (
          <Panel key={label}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">
              {brl.format(v)}
            </p>
          </Panel>
        ))}
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {accounts.map((a) => (
          <div key={a.id} className="[&>div]:min-w-full">
            <AccountCardVisual account={a} />
          </div>
        ))}
      </div>

      <Panel>
        <PanelHeader
          title="Conexões"
          subtitle="Remover uma conexão só a tira deste painel; o consentimento continua no Meu Pluggy."
        />
        <div className="divide-y">
          {itemIds.map((id) => {
            const accs = accounts.filter((a) => a.itemId === id);
            return (
              <div key={id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {accs.length > 0
                      ? accs.map((a) => a.marketingName || a.name).join(" · ")
                      : "Conexão sem contas"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {accs.length} {accs.length === 1 ? "conta" : "contas"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-full"
                  onClick={() => removeItem(id)}
                >
                  <X size={14} /> Remover
                </Button>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}
