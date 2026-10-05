"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEMO_MONTHS,
  DEMO_SEGMENTS,
  RAMP,
  brl0,
  brlK,
  expenseOf,
  type DemoMonth,
} from "./demo-data";

const W = 560;
const H = 250;
const M = { top: 26, right: 8, bottom: 54, left: 8 };
const plotW = W - M.left - M.right;
const plotH = H - M.top - M.bottom;

function niceMax(v: number) {
  const steps = [100000, 150000, 200000, 250000, 300000];
  return steps.find((s) => s >= v) ?? v;
}

// painel de demonstração interativo (dados fictícios)
export function DemoDashboard({
  className,
  reserveBottom = false,
}: {
  className?: string;
  reserveBottom?: boolean;
}) {
  const [sel, setSel] = useState("out");
  const cur = DEMO_MONTHS.find((m) => m.key === sel) ?? DEMO_MONTHS[4];
  const exp = expenseOf(cur);
  const result = cur.income - exp;

  const max = niceMax(Math.max(...DEMO_MONTHS.map((m) => Math.max(m.income, expenseOf(m)))));
  const y = (v: number) => plotH - (v / max) * plotH;
  const gw = plotW / DEMO_MONTHS.length;
  const bw = Math.min(30, gw * 0.3);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl border bg-card shadow-[0_30px_80px_-30px_rgb(0_0_0/0.35)]",
        className
      )}
      role="group"
      aria-label="Painel de demonstração com dados fictícios"
    >
      {/* barra da janela */}
      <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 flex items-center gap-1.5 rounded-full bg-background px-3 py-0.5 text-[11px] text-muted-foreground">
          <ShieldCheck size={11} /> painel.suaempresa.com.br
        </span>
        <span className="ml-auto rounded-md bg-primary/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
          dados fictícios
        </span>
      </div>

      <div className={cn("space-y-4 p-4 sm:p-5", reserveBottom && "xl:pb-12")}>
        {/* indicadores do mês selecionado */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Kpi
            label="Entradas"
            value={cur.future ? "—" : brl0.format(cur.income)}
            dot="var(--c-income)"
          />
          <Kpi
            label={cur.future ? "Despesa prevista" : "Despesa total"}
            value={brl0.format(exp)}
            dot={cur.future ? "var(--c-fixed)" : "var(--c-total)"}
          />
          <div className="rounded-2xl border bg-background/50 p-3">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Resultado
            </p>
            {cur.future ? (
              <p className="mt-1 text-sm font-semibold text-muted-foreground">previsto</p>
            ) : (
              <p
                className={cn(
                  "mt-1 flex items-center gap-1 text-sm font-bold tabular-nums sm:text-base",
                  result >= 0 ? "text-good" : "text-bad"
                )}
              >
                {result >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {result >= 0 ? "+" : "−"}
                {brl0.format(Math.abs(result))}
              </p>
            )}
          </div>
        </div>

        {/* gráfico: entradas × despesa total */}
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full min-w-[460px]"
            role="img"
            aria-label="Gráfico de barras de entradas e despesas por mês"
          >
            {[0.5, 1].map((f) => (
              <line
                key={f}
                x1={M.left}
                x2={W - M.right}
                y1={M.top + y(max * f)}
                y2={M.top + y(max * f)}
                stroke="currentColor"
                strokeOpacity={0.1}
                strokeDasharray="3 4"
              />
            ))}
            <line
              x1={M.left}
              x2={W - M.right}
              y1={M.top + plotH}
              y2={M.top + plotH}
              stroke="currentColor"
              strokeOpacity={0.2}
            />
            {DEMO_MONTHS.map((m, i) => (
              <MonthBars
                key={m.key}
                m={m}
                i={i}
                gw={gw}
                bw={bw}
                y={y}
                selected={m.key === sel}
                onSelect={() => setSel(m.key)}
              />
            ))}
          </svg>
        </div>

        {/* segmentos de gasto */}
        <div>
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold">Para onde vai o dinheiro</span>
            <span className="text-muted-foreground">out · categorização automática</span>
          </div>
          <div
            className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label="Participação de cada segmento nas despesas"
          >
            {DEMO_SEGMENTS.map((s, i) => (
              <div
                key={s.label}
                title={`${s.label}: ${s.share}%`}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${s.share}%`, background: RAMP[i] }}
              />
            ))}
          </div>
          <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground sm:grid-cols-3">
            {DEMO_SEGMENTS.map((s, i) => (
              <li key={s.label} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-sm"
                  style={{ background: RAMP[i] }}
                />
                <span className="truncate">{s.label}</span>
                <span className="ml-auto font-semibold tabular-nums text-foreground">
                  {s.share}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, dot }: { label: string; value: string; dot: string }) {
  return (
    <div className="rounded-2xl border bg-background/50 p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
        {label}
      </p>
      <p className="mt-1 text-sm font-bold tabular-nums sm:text-base">{value}</p>
    </div>
  );
}

function MonthBars({
  m,
  i,
  gw,
  bw,
  y,
  selected,
  onSelect,
}: {
  m: DemoMonth;
  i: number;
  gw: number;
  bw: number;
  y: (v: number) => number;
  selected: boolean;
  onSelect: () => void;
}) {
  const cx = M.left + gw * i + gw / 2;
  const exp = expenseOf(m);
  const layers = m.future
    ? [
        { v: m.fixed, c: "var(--c-fixed)" },
        { v: m.card, c: "var(--c-card)" },
      ]
    : [{ v: exp, c: "var(--c-total)" }];
  const res = m.income - exp;
  let acc = 0;
  return (
    <g
      onClick={onSelect}
      onMouseEnter={onSelect}
      className="cursor-pointer"
      role="button"
      tabIndex={0}
      aria-label={`Selecionar ${m.label}`}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect()}
    >
      <rect
        x={M.left + gw * i + 3}
        y={M.top - 22}
        width={gw - 6}
        height={plotH + 22 + 56}
        rx={12}
        style={{ fill: "var(--primary)", fillOpacity: selected ? 0.16 : 0 }}
      />
      {!m.future && (
        <>
          <rect
            x={cx - 2 - bw}
            y={M.top + y(m.income)}
            width={bw}
            height={plotH - y(m.income)}
            rx={4}
            fill="var(--c-income)"
          />
          <text
            x={cx - 2 - bw / 2}
            y={M.top + y(m.income) - 6}
            textAnchor="middle"
            fontSize={10}
            fontWeight={600}
            fill="currentColor"
          >
            {Math.round(m.income / 1000)}k
          </text>
        </>
      )}
      {layers.map((l, li) => {
        const y1 = y(acc + l.v);
        const y0 = y(acc);
        acc += l.v;
        const gap = li < layers.length - 1 ? 2 : 0;
        const h = Math.max(0, y0 - y1 - gap);
        if (h <= 0) return null;
        return (
          <rect
            key={li}
            x={cx + 2}
            y={M.top + y1 + gap}
            width={bw}
            height={h}
            rx={4}
            fill={l.c}
            fillOpacity={m.future ? 0.6 : 1}
          />
        );
      })}
      <text
        x={cx + 2 + bw / 2}
        y={M.top + y(exp) - 6}
        textAnchor="middle"
        fontSize={10}
        fontWeight={600}
        fill="currentColor"
      >
        {Math.round(exp / 1000)}k
      </text>
      <text
        x={cx}
        y={H - 32}
        textAnchor="middle"
        fontSize={12}
        fontWeight={selected ? 700 : 500}
        fill="currentColor"
        fillOpacity={selected ? 1 : 0.65}
      >
        {m.label}
      </text>
      {m.future ? (
        <text x={cx} y={H - 14} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.5}>
          previsto
        </text>
      ) : (
        <text
          x={cx}
          y={H - 14}
          textAnchor="middle"
          fontSize={10.5}
          fontWeight={700}
          style={{ fill: res >= 0 ? "var(--c-good)" : "var(--c-bad)" }}
        >
          {res >= 0 ? "▲ +" : "▼ −"}
          {brlK(Math.abs(res)).replace("R$ ", "")}
        </text>
      )}
    </g>
  );
}
