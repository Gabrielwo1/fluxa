"use client";

import { CategoryBadge } from "@/lib/icons";
import { translateCategory } from "@/lib/categories";
import { brl, splitDescription } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useFinance, type Tx } from "@/components/finance-provider";

export function TxRow({
  tx,
  compact = false,
  showAccount = true,
}: {
  tx: Tx;
  compact?: boolean;
  showAccount?: boolean;
}) {
  const { flowOf, accountName } = useFinance();
  const f = flowOf(tx);
  const minus =
    f.kind === "expense"
      ? f.value >= 0
      : f.kind === "invest"
        ? f.value > 0
        : f.kind === "ignore"
          ? tx.amount < 0
          : false;
  const d = splitDescription(tx.description);
  const tag =
    f.kind === "invest"
      ? "investimento"
      : f.kind === "ignore"
        ? "entre contas"
        : null;

  return (
    <div className={cn("flex items-center justify-between gap-3", compact ? "py-2" : "py-3")}>
      <div className="flex min-w-0 items-center gap-3">
        <CategoryBadge category={tx.category} size={compact ? 8 : 9} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" title={tx.description}>
            {d.title}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {new Date(tx.date).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
            })}
            {showAccount && ` · ${accountName.get(tx.accountId) ?? "Conta"}`}
            {` · ${translateCategory(tx.category)}`}
            {d.kind && ` · ${d.kind.toLowerCase()}`}
            {tag && ` · ${tag}`}
          </p>
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          f.kind === "income" && "text-good"
        )}
      >
        {minus ? "−" : "+"}
        {brl.format(Math.abs(tx.amount))}
      </span>
    </div>
  );
}
