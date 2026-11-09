"use client";

import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right";
  className?: string;
  // some em telas pequenas (no celular a linha vira um cartão)
  hideOnMobile?: boolean;
};

// Tabela no computador; no celular cada linha vira um cartão (mobileCard) fácil de tocar.
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  mobileCard,
  footer,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  mobileCard?: (row: T) => React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              {columns.map((c) => (
                <th key={c.key} className={cn("px-3 py-2.5 font-medium", c.align === "right" ? "text-right" : "text-left", c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                onKeyDown={onRowClick ? (e) => (e.key === "Enter" ? onRowClick(r) : undefined) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn("transition-colors", onRowClick && "cursor-pointer hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none")}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-3 py-3 align-middle", c.align === "right" && "text-right tabular-nums", c.className)}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>
      <ul className="divide-y md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)}>
            <div
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={cn("py-3", onRowClick && "cursor-pointer active:bg-muted/60")}
            >
              {mobileCard ? mobileCard(r) : columns.filter((c) => !c.hideOnMobile).map((c) => <div key={c.key}>{c.cell(r)}</div>)}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
