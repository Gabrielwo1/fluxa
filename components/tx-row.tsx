"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
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
    <div className={cn("group/tx flex items-center justify-between gap-3", compact ? "py-2" : "py-3")}>
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
      <div className="flex shrink-0 items-center gap-2">
        {/* Dinheiro que entrou quase sempre precisa de nota: o atalho leva a frase pronta. */}
        {f.kind === "income" && (
          <Link
            href={`/emitir?texto=${encodeURIComponent(
              `Recebi ${brl.format(Math.abs(tx.amount))} de ${d.title} em ${new Date(tx.date).toLocaleDateString("pt-BR")}`
            )}`}
            title="Emitir nota desta entrada"
            aria-label="Emitir nota desta entrada"
            className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/tx:opacity-100"
          >
            <FileText className="size-3.5" />
          </Link>
        )}
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            f.kind === "income" && "text-good"
          )}
        >
          {minus ? "−" : "+"}
          {brl.format(Math.abs(tx.amount))}
        </span>
      </div>
    </div>
  );
}
