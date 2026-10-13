"use client";

import { useEffect, useRef, useState } from "react";
import { brlCompact } from "@/lib/format";

export type ChartPoint = {
  label: string; // rótulo do eixo e do tooltip
  layers: number[]; // valores empilhados, de baixo para cima
  tip: [string, string][]; // linhas do tooltip
};

export type ChartLayer = { name: string; color: string };

// topo do eixo com passos mais finos que o niceCeil, para não sobrar metade do gráfico vazia
function axisTop(v: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1))));
  for (const f of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (f * pow >= v) return f * pow;
  }
  return 10 * pow;
}

const M = { top: 16, right: 12, bottom: 30, left: 64 };

// Áreas empilhadas a partir do zero, com tooltip ao passar o mouse ou tocar.
export function GrowthChart({
  points,
  layers,
  summary,
}: {
  points: ChartPoint[];
  layers: ChartLayer[];
  summary: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // desenha em pixels reais da tela para o texto não encolher no celular
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(160, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = Math.min(340, Math.max(220, Math.round(W * 0.42)));
  const pw = W - M.left - M.right;
  const ph = H - M.top - M.bottom;
  const last = points.length - 1;
  const totals = points.map((p) => p.layers.reduce((a, b) => a + b, 0));
  const yMax = axisTop(Math.max(1, ...totals));
  const x = (i: number) => M.left + (last > 0 ? (i / last) * pw : 0);
  const y = (v: number) => M.top + ph - (v / yMax) * ph;

  // acumulado de cada camada: base[l][i] .. top[l][i]
  const tops = layers.map((_, l) =>
    points.map((p) => p.layers.slice(0, l + 1).reduce((a, b) => a + b, 0))
  );
  const area = (l: number) => {
    const upper = tops[l].map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    const lower = (l === 0 ? points.map(() => 0) : tops[l - 1])
      .map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      .reverse();
    return `M${upper.join("L")}L${lower.join("L")}Z`;
  };
  const line = (l: number) =>
    "M" + tops[l].map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("L");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);
  const xStep = Math.max(1, Math.ceil(points.length / (W < 420 ? 3 : 6)));
  const xTicks = points.map((_, i) => i).filter((i) => i % xStep === 0 || i === last);
  const h = hover !== null ? points[hover] : null;

  function pick(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - M.left) / pw) * last);
    setHover(Math.min(last, Math.max(0, i)));
  }

  return (
    <div className="relative w-full min-w-0" ref={box}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={summary}
        className="block touch-pan-y"
        width={W}
        height={H}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setHover(null)}
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} stroke="var(--border)" />
            <text
              x={M.left - 8}
              y={y(v) + 4}
              textAnchor="end"
              className="fill-muted-foreground text-xs"
            >
              {brlCompact.format(v)}
            </text>
          </g>
        ))}
        {xTicks.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"}
            className="fill-muted-foreground text-xs"
          >
            {points[i].label}
          </text>
        ))}
        {layers.map((l, i) => (
          <g key={l.name}>
            <path d={area(i)} fill={l.color} fillOpacity={0.22} />
            <path
              d={line(i)}
              fill="none"
              stroke={l.color}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
          </g>
        ))}
        {hover !== null && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={M.top}
              y2={M.top + ph}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
            />
            {layers.map((l, i) => (
              <circle
                key={l.name}
                cx={x(hover)}
                cy={y(tops[i][hover])}
                r={5}
                fill={l.color}
                stroke="var(--card)"
                strokeWidth={2}
              />
            ))}
          </g>
        )}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-xl border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            transform: `translateX(${hover > last / 2 ? "calc(-100% - 12px)" : "12px"})`,
          }}
        >
          <p className="mb-1 font-semibold">{h.label}</p>
          {h.tip.map(([k, v]) => (
            <p key={k} className="flex justify-between gap-4">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium tabular-nums">{v}</span>
            </p>
          ))}
        </div>
      )}
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        {layers.map((l) => (
          <li key={l.name} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />
            {l.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
