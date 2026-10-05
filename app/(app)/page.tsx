"use client";

import { useFinance } from "@/components/finance-provider";
import { EmptyConnect } from "@/components/ui-kit";
import { CashflowCard } from "@/components/dashboard/cashflow-card";
import {
  CostAnalysisCard,
  FixedBillsCard,
  HealthCard,
  InsightCard,
  SpendingLimitCard,
  StatsColumn,
} from "@/components/dashboard/summary-cards";
import {
  AccountsRail,
  QuickActions,
  RecentTransactions,
} from "@/components/dashboard/rail";

export default function DashboardPage() {
  const { ready, itemIds } = useFinance();
  if (!ready) return null;
  if (itemIds.length === 0) return <EmptyConnect />;

  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="grid min-w-0 gap-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <CashflowCard />
          <StatsColumn />
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <SpendingLimitCard />
          <InsightCard />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <CostAnalysisCard />
          <HealthCard />
          <FixedBillsCard />
        </div>
      </div>
      <aside className="grid min-w-0 content-start gap-4 md:grid-cols-2 2xl:grid-cols-1">
        <div className="grid min-w-0 content-start gap-4">
          <AccountsRail />
          <QuickActions />
        </div>
        <RecentTransactions />
      </aside>
    </div>
  );
}
