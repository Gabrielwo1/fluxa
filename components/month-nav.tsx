"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { monthLabel, shiftMonth } from "@/lib/format";
import { useFinance } from "@/components/finance-provider";

export function MonthNav() {
  const { cur, selectedMonth, firstKey, lastKey, selectMonth, currentKey } =
    useFinance();
  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="ghost"
        size="sm"
        className="rounded-full text-xs"
        onClick={() => selectMonth(currentKey)}
        disabled={selectedMonth === currentKey}
      >
        Hoje
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={() => selectMonth(shiftMonth(selectedMonth, -1))}
        disabled={selectedMonth <= firstKey}
        aria-label="Mês anterior"
      >
        <ChevronLeft size={15} />
      </Button>
      <span className="flex min-w-24 items-center justify-center gap-1.5 text-sm font-semibold">
        {monthLabel(cur.key)}
        {cur.future && (
          <span className="rounded-md bg-fixed/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fixed">
            previsto
          </span>
        )}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={() => selectMonth(shiftMonth(selectedMonth, 1))}
        disabled={selectedMonth >= lastKey}
        aria-label="Próximo mês"
      >
        <ChevronRight size={15} />
      </Button>
    </div>
  );
}
