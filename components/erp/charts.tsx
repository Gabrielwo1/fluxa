"use client";

import { useEffect, useRef, useState } from "react";
import { brlCompact } from "@/lib/format";
import { money, monthShort } from "@/lib/erp/format";

const M = { top: 12, right: 8, bottom: 26, left: 56 };

function axisTop(v: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1))));
  for (const f of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (f * pow >= v) return f * pow;
  return 10 * pow;
}

export type BarSeries = { key: string; label: string; color: string };

// Barras agrupadas por mês (vendas, recebido, pago…). Desenha em pixels reais para o texto não encolher.
export function MonthBars({
  data,
  series,
  height = 240,
}: {
  data: ({ month: string } & Record<string, number | string>)[];
  series: BarSeries[];
  height?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(560);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(220, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pw = w - M.left - M.right;
  const ph = height - M.top - M.bottom;
  const max = axisTop(Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0))));
  const y = (v: number) => M.top + ph - (v / max) * ph;
  const group = pw / Math.max(1, data.length);
  const barW = Math.min(22, (group * 0.78) / series.length);
  const h = hover !== null ? data[hover] : null;

  return (
    <div ref={box} className="relative w-full min-w-0">
      <svg
        width={w}
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        role="img"
        aria-label={`Gráfico de ${series.map((s) => s.label).join(", ")} por mês`}
        className="block"
        onPointerLeave={() => setHover(null)}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={M.left} x2={w - M.right} y1={y(max * f)} y2={y(max * f)} stroke="var(--border)" />
            <text x={M.left - 6} y={y(max * f) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
              {brlCompact.format(max * f)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const gx = M.left + group * i + group / 2 - (barW * series.length) / 2;
          return (
            <g key={d.month} onPointerMove={() => setHover(i)}>
              <rect x={M.left + group * i} y={M.top} width={group} height={ph} fill="transparent" />
              {series.map((s, k) => {
                const v = Number(d[s.key]) || 0;
                return <rect key={s.key} x={gx + k * barW} y={y(v)} width={Math.max(2, barW - 2)} height={Math.max(0, M.top + ph - y(v))} rx={3} fill={s.color} opacity={hover === null || hover === i ? 1 : 0.45} />;
              })}
              <text x={M.left + group * i + group / 2} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                {monthShort(String(d.month))}
              </text>
            </g>
          );
        })}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-40 rounded-xl border bg-popover px-3 py-2 text-xs shadow-md"
          style={{ left: `${((M.left + group * hover + group / 2) / w) * 100}%`, transform: `translateX(${hover > data.length / 2 ? "calc(-100% - 10px)" : "10px"})` }}
        >
          <p className="mb-1 font-semibold">{monthShort(String(h.month))}</p>
          {series.map((s) => (
            <p key={s.key} className="flex justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="font-medium tabular-nums">{money(Number(h[s.key]) || 0)}</span>
            </p>
          ))}
        </div>
      )}
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Barras horizontais para rankings (top clientes, top produtos).
export function RankBars({ rows, color = "var(--c-income)" }: { rows: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{r.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{money(r.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Linha do saldo projetado: aceita valores negativos e destaca a linha do zero.
export function BalanceLine({ points, height = 240 }: { points: { date: string; balance: number }[]; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(560);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(220, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pw = w - M.left - M.right;
  const ph = height - M.top - M.bottom;
  const values = points.map((p) => p.balance);
  const hi = Math.max(0, ...values);
  const lo = Math.min(0, ...values);
  const span = axisTop(Math.max(hi - lo, 1));
  const top = lo < 0 ? hi + (span - (hi - lo)) * 0.5 : span + lo;
  const bottom = top - span;
  const x = (i: number) => M.left + (points.length > 1 ? (i / (points.length - 1)) * pw : 0);
  const y = (v: number) => M.top + ph - ((v - bottom) / span) * ph;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.balance).toFixed(1)}`).join("");
  const area = `${path}L${x(points.length - 1).toFixed(1)},${y(Math.max(bottom, Math.min(0, top))).toFixed(1)}L${x(0).toFixed(1)},${y(Math.max(bottom, Math.min(0, top))).toFixed(1)}Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => bottom + span * f);
  const step = Math.max(1, Math.ceil(points.length / (w < 420 ? 3 : 6)));
  const h = hover !== null ? points[hover] : null;
  const negative = Math.min(...values) < 0;

  return (
    <div ref={box} className="relative w-full min-w-0">
      <svg
        width={w}
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        role="img"
        aria-label={`Saldo previsto: de ${money(values[0] ?? 0)} para ${money(values[values.length - 1] ?? 0)}`}
        className="block touch-pan-y"
        onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.round((((e.clientX - r.left) - M.left) / pw) * (points.length - 1));
          setHover(Math.min(points.length - 1, Math.max(0, i)));
        }}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={w - M.right} y1={y(v)} y2={y(v)} stroke="var(--border)" />
            <text x={M.left - 6} y={y(v) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">{brlCompact.format(v)}</text>
          </g>
        ))}
        {bottom < 0 && top > 0 && <line x1={M.left} x2={w - M.right} y1={y(0)} y2={y(0)} stroke="var(--c-bad)" strokeDasharray="4 4" />}
        <path d={area} fill={negative ? "var(--c-bad)" : "var(--c-income)"} fillOpacity={0.15} />
        <path d={path} fill="none" stroke={negative ? "var(--c-bad)" : "var(--c-income)"} strokeWidth={2.5} strokeLinejoin="round" />
        {points.map((p, i) =>
          i % step === 0 || i === points.length - 1 ? (
            <text key={p.date} x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} className="fill-muted-foreground text-[11px]">
              {p.date.slice(8)}/{p.date.slice(5, 7)}
            </text>
          ) : null
        )}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + ph} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
            <circle cx={x(hover)} cy={y(points[hover].balance)} r={5} fill={points[hover].balance < 0 ? "var(--c-bad)" : "var(--c-income)"} stroke="var(--card)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {h && hover !== null && (
        <div className="pointer-events-none absolute top-1 z-10 rounded-xl border bg-popover px-3 py-2 text-xs shadow-md" style={{ left: `${(x(hover) / w) * 100}%`, transform: `translateX(${hover > points.length / 2 ? "calc(-100% - 10px)" : "10px"})` }}>
          <p className="font-semibold">{h.date.slice(8)}/{h.date.slice(5, 7)}/{h.date.slice(0, 4)}</p>
          <p className="tabular-nums">Saldo previsto: <strong className={h.balance < 0 ? "text-bad" : undefined}>{money(h.balance)}</strong></p>
        </div>
      )}
    </div>
  );
}
