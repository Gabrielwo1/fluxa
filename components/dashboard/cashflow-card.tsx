"use client";

import { useRef, useState } from "react";
import { Panel } from "@/components/ui-kit";
import { MonthNav } from "@/components/month-nav";
import { useFinance } from "@/components/finance-provider";
import { brl, brlCompact, monthLabel, niceCeil, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

const HW = 1000;
const HH = 360;
const HM = { top: 34, right: 12, bottom: 74, left: 58 };
const plotW = HW - HM.left - HM.right;
const plotH = HH - HM.top - HM.bottom;
const BAR_GAP = 8;

type Hover = { key: string; x: number; y: number; w: number };

const LEGEND: [string, string][] = [
  ["Entradas", "var(--c-income)"],
  ["Despesa total", "var(--c-total)"],
  ["Contas fixas (previsto)", "var(--c-fixed)"],
  ["Parcelas do cartão (previsto)", "var(--c-card)"],
];

export function CashflowCard() {
  const { months, cur, selectedMonth, selectMonth } = useFinance();
  const chartRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  const hMax = niceCeil(
    Math.max(1, ...months.map((m) => Math.max(m.income, m.expense)))
  );
  const hy = (v: number) => plotH - (v / hMax) * plotH;
  const groupW = plotW / months.length;
  const barW = Math.min(46, groupW * 0.3);
  const cx = (i: number) => HM.left + groupW * i + groupW / 2;
  const incomeX = (i: number) => cx(i) - BAR_GAP / 2 - barW;
  const expenseX = (i: number) => cx(i) + BAR_GAP / 2;

  const result = cur.income - cur.expense;
  const hovered = hover ? months.find((m) => m.key === hover.key) : null;

  return (
    <Panel className="p-6">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {cur.future
              ? `Despesa prevista em ${monthLabel(cur.key)}`
              : `Resultado de ${monthLabel(cur.key)}`}
          </p>
          <p
            className={cn(
              "mt-1 text-4xl font-bold tabular-nums tracking-tight",
              !cur.future && (result >= 0 ? "text-good" : "text-bad")
            )}
          >
            {cur.future
              ? brl.format(cur.expense)
              : `${result >= 0 ? "+" : "−"}${brl.format(Math.abs(result))}`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {cur.future
              ? "contas fixas + parcelas do cartão já lançadas"
              : result >= 0
                ? "▲ entradas acima das despesas no mês"
                : "▼ despesas acima das entradas no mês"}
          </p>
        </div>
        <MonthNav />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
        {LEGEND.map(([label, color]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: color }}
            />
            {label}
          </span>
        ))}
      </div>

      <div className="-mx-2 overflow-x-auto px-2 pb-1">
      <div className="relative min-w-[640px]" ref={chartRef}>
        <svg
          viewBox={`0 0 ${HW} ${HH}`}
          className="h-auto w-full"
          role="img"
          aria-label="Gráfico de barras por mês: entradas ao lado da despesa total"
        >
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line
                x1={HM.left}
                x2={HW - HM.right}
                y1={HM.top + hy(hMax * f)}
                y2={HM.top + hy(hMax * f)}
                stroke="currentColor"
                strokeOpacity={0.1}
                strokeDasharray="3 4"
              />
              <text
                x={HM.left - 8}
                y={HM.top + hy(hMax * f) + 3}
                textAnchor="end"
                fontSize={11}
                fill="currentColor"
                fillOpacity={0.5}
              >
                {brlCompact.format(hMax * f)}
              </text>
            </g>
          ))}
          <line
            x1={HM.left}
            x2={HW - HM.right}
            y1={HM.top + plotH}
            y2={HM.top + plotH}
            stroke="currentColor"
            strokeOpacity={0.2}
          />

          {months.map((m, i) => {
            const selected = m.key === selectedMonth;
            const res = m.income - m.expense;
            const layers = m.future
              ? [
                  { v: m.fixed, c: "var(--c-fixed)" },
                  { v: m.card, c: "var(--c-card)" },
                ]
              : [{ v: m.expense, c: "var(--c-total)" }];
            let acc = 0;
            const track = (e: React.MouseEvent) => {
              const rect = chartRef.current?.getBoundingClientRect();
              if (rect) {
                setHover({
                  key: m.key,
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                  w: rect.width,
                });
              }
            };
            return (
              <g
                key={m.key}
                onMouseEnter={track}
                onMouseMove={track}
                onMouseLeave={() => setHover(null)}
                onClick={() => selectMonth(m.key)}
                className="cursor-pointer"
              >
                <rect
                  x={HM.left + groupW * i + 4}
                  y={HM.top - 28}
                  width={groupW - 8}
                  height={plotH + 28 + 70}
                  rx={14}
                  style={{
                    fill: "var(--primary)",
                    fillOpacity: selected ? 0.16 : hover?.key === m.key ? 0.08 : 0,
                  }}
                />

                {!m.future && m.income > 0 && (
                  <>
                    <rect
                      x={incomeX(i)}
                      y={HM.top + hy(m.income)}
                      width={barW}
                      height={plotH - hy(m.income)}
                      rx={5}
                      fill="var(--c-income)"
                    />
                    <text
                      x={incomeX(i) + barW / 2}
                      y={HM.top + hy(m.income) - 8}
                      textAnchor="middle"
                      fontSize={11.5}
                      fontWeight={600}
                      fill="currentColor"
                    >
                      {brlCompact.format(m.income)}
                    </text>
                  </>
                )}

                {layers.map((l, li) => {
                  const y1 = hy(acc + l.v);
                  const y0 = hy(acc);
                  acc += l.v;
                  const gap = li < layers.length - 1 ? 2 : 0;
                  const h = Math.max(0, y0 - y1 - gap);
                  if (l.v <= 0 || h <= 0) return null;
                  return (
                    <rect
                      key={li}
                      x={expenseX(i)}
                      y={HM.top + y1 + gap}
                      width={barW}
                      height={h}
                      rx={5}
                      fill={l.c}
                      fillOpacity={m.future ? 0.6 : 1}
                    />
                  );
                })}
                <text
                  x={expenseX(i) + barW / 2}
                  y={HM.top + hy(m.expense) - 8}
                  textAnchor="middle"
                  fontSize={11.5}
                  fontWeight={600}
                  fill="currentColor"
                >
                  {brlCompact.format(m.expense)}
                </text>

                <text
                  x={cx(i)}
                  y={HH - 50}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={selected ? 700 : 500}
                  fill="currentColor"
                  fillOpacity={selected ? 1 : 0.65}
                >
                  {monthLabel(m.key)}
                </text>
                {m.future ? (
                  <text
                    x={cx(i)}
                    y={HH - 30}
                    textAnchor="middle"
                    fontSize={11}
                    fill="currentColor"
                    fillOpacity={0.5}
                  >
                    previsto
                  </text>
                ) : (
                  <>
                    <text
                      x={cx(i)}
                      y={HH - 30}
                      textAnchor="middle"
                      fontSize={12}
                      fontWeight={700}
                      style={{ fill: res >= 0 ? "var(--c-good)" : "var(--c-bad)" }}
                    >
                      {res >= 0 ? "▲ +" : "▼ −"}
                      {brlCompact.format(Math.abs(res))}
                    </text>
                    <text
                      x={cx(i)}
                      y={HH - 12}
                      textAnchor="middle"
                      fontSize={10.5}
                      fill="currentColor"
                      fillOpacity={0.5}
                    >
                      {pct(m.expense, m.income) === null
                        ? "—"
                        : `despesa ${pct(m.expense, m.income)}%`}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>

        {hover && hovered && (
          <div
            className="pointer-events-none absolute z-10 min-w-52 rounded-xl border bg-popover px-3 py-2.5 text-xs text-popover-foreground shadow-lg"
            style={{
              left: Math.max(0, Math.min(hover.x + 14, hover.w - 230)),
              top: Math.max(0, hover.y - 110),
            }}
          >
            <p className="mb-1.5 text-sm font-semibold">
              {monthLabel(hovered.key)}
              {hovered.future && (
                <span className="ml-2 font-normal text-muted-foreground">
                  previsto
                </span>
              )}
            </p>
            {!hovered.future && (
              <Row
                color="var(--c-income)"
                label="Entradas"
                value={brl.format(hovered.income)}
              />
            )}
            {hovered.future && (
              <>
                <Row
                  color="var(--c-fixed)"
                  label="Contas fixas"
                  value={brl.format(hovered.fixed)}
                />
                <Row
                  color="var(--c-card)"
                  label="Parcelas do cartão"
                  value={brl.format(hovered.card)}
                />
              </>
            )}
            <div
              className={cn(
                "flex justify-between gap-4 font-semibold tabular-nums",
                hovered.future && "mt-1.5 border-t pt-1.5"
              )}
            >
              <span className="flex items-center gap-1.5">
                {!hovered.future && (
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: "var(--c-total)" }}
                  />
                )}
                {hovered.future ? "Despesa prevista" : "Despesa total"}
              </span>
              <span>
                {brl.format(hovered.expense)}
                {!hovered.future && pct(hovered.expense, hovered.income) !== null && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    ({pct(hovered.expense, hovered.income)}%)
                  </span>
                )}
              </span>
            </div>
            {!hovered.future && (
              <>
                <div className="flex justify-between gap-4 pl-3.5 tabular-nums text-muted-foreground">
                  <span>no cartão</span>
                  <span>{brl.format(hovered.card)}</span>
                </div>
                <div className="flex justify-between gap-4 pl-3.5 tabular-nums text-muted-foreground">
                  <span>na conta</span>
                  <span>{brl.format(hovered.bank)}</span>
                </div>
                <div
                  className="mt-1 flex justify-between gap-4 font-semibold tabular-nums"
                  style={{
                    color:
                      hovered.income - hovered.expense >= 0
                        ? "var(--c-good)"
                        : "var(--c-bad)",
                  }}
                >
                  <span>
                    {hovered.income - hovered.expense >= 0
                      ? "▲ Positivo"
                      : "▼ Negativo"}
                  </span>
                  <span>
                    {hovered.income - hovered.expense >= 0 ? "+" : "−"}
                    {brl.format(Math.abs(hovered.income - hovered.expense))}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground/80">
        Entradas não incluem resgates de investimento nem transferências entre
        contas próprias; aportes ficam fora das despesas. As contas fixas
        cadastradas só entram nos meses futuros — nos demais já estão dentro da
        despesa real.
      </p>
    </Panel>
  );
}

function Row({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 tabular-nums">
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: color }}
        />
        {label}
      </span>
      <span>{value}</span>
    </div>
  );
}
