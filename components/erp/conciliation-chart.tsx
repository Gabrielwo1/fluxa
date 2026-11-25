"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { brlCompact } from "@/lib/format";
import { fmtDateShort, money } from "@/lib/erp/format";
import { crossings, cumulative, type Crossing, type Curve } from "@/lib/erp/reconcile";

// "Três fios": vendas, notas fiscais e dinheiro no banco, acumulados dia a dia. Onde uma linha passa por
// cima da outra há um nó que pulsa; a faixa entre duas linhas é o que ainda falta conciliar (pintada
// conforme quem está na frente). Embaixo, o "espelho do dia": o que se vendeu para cima, o que entrou
// no banco para baixo, no mesmo eixo de dias, para ver se cada dia teve o seu par.

const M = { top: 14, right: 92, bottom: 6, left: 54 };
const MAIN_H = 270;
const MIRROR_H = 116;
const AXIS_H = 24;

export type Fill = "bank" | "notes";

type Key = "sales" | "invoices" | "bank";
const STYLE: Record<Key, { label: string; color: string }> = {
  sales: { label: "Vendas", color: "var(--c-total)" },
  invoices: { label: "Notas", color: "var(--c-fixed)" },
  bank: { label: "Banco", color: "var(--c-income)" },
};

function axisTop(v: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1))));
  for (const f of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (f * pow >= v) return f * pow;
  return 10 * pow;
}

type Pt = [number, number];

// Região entre duas curvas, dividida onde elas se cruzam: cada pedaço sabe quem está por cima.
function ribbons(a: number[], b: number[], x: (i: number) => number, y: (v: number) => number): { pts: Pt[]; aboveIsA: boolean }[] {
  const out: { pts: Pt[]; aboveIsA: boolean }[] = [];
  for (let i = 0; i < a.length - 1; i++) {
    const d0 = a[i] - b[i];
    const d1 = a[i + 1] - b[i + 1];
    const x0 = x(i);
    const x1 = x(i + 1);
    if (d0 * d1 >= 0) {
      if (d0 === 0 && d1 === 0) continue;
      out.push({ aboveIsA: (d0 !== 0 ? d0 : d1) > 0, pts: [[x0, y(a[i])], [x1, y(a[i + 1])], [x1, y(b[i + 1])], [x0, y(b[i])]] });
    } else {
      const t = d0 / (d0 - d1);
      const xc = x0 + t * (x1 - x0);
      const yc = y(a[i] + (a[i + 1] - a[i]) * t);
      out.push({ aboveIsA: d0 > 0, pts: [[x0, y(a[i])], [xc, yc], [x0, y(b[i])]] });
      out.push({ aboveIsA: d1 > 0, pts: [[xc, yc], [x1, y(a[i + 1])], [x1, y(b[i + 1])]] });
    }
  }
  return out;
}

const path = (pts: Pt[]) => pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("");

export type CrossingNote = Crossing & { date: string; pair: string };

export function ConciliationChart({
  days,
  sales,
  invoices,
  bank,
  fill,
  onCrossings,
}: {
  days: string[];
  sales: number[];
  invoices: number[];
  // null = sem banco conectado: o terceiro fio some
  bank: number[] | null;
  fill: Fill;
  onCrossings?: (list: CrossingNote[]) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = days.length;
  const curves = useMemo(() => {
    const list: (Curve & { key: Key })[] = [
      { key: "sales", label: STYLE.sales.label, values: cumulative(sales) },
      { key: "invoices", label: STYLE.invoices.label, values: cumulative(invoices) },
    ];
    if (bank) list.push({ key: "bank", label: STYLE.bank.label, values: cumulative(bank) });
    return list;
  }, [sales, invoices, bank]);
  const by = (k: Key) => curves.find((c) => c.key === k);

  const found = useMemo<CrossingNote[]>(() => {
    const out: CrossingNote[] = [];
    for (let i = 0; i < curves.length; i++) {
      for (let j = i + 1; j < curves.length; j++) {
        for (const c of crossings(curves[i], curves[j])) {
          out.push({ ...c, pair: `${curves[i].key}-${curves[j].key}`, date: days[Math.min(n - 1, Math.round(c.index + c.t))] });
        }
      }
    }
    return out.sort((p, q) => p.index + p.t - (q.index + q.t));
  }, [curves, days, n]);
  useEffect(() => onCrossings?.(found), [found, onCrossings]);

  const pw = w - M.left - M.right;
  const maxV = axisTop(Math.max(1, ...curves.flatMap((c) => c.values)));
  const x = (i: number) => M.left + ((i + 0.5) / Math.max(n, 1)) * pw;
  const y = (v: number) => M.top + (MAIN_H - M.top - M.bottom) - (v / maxV) * (MAIN_H - M.top - M.bottom);

  // faixas entre as linhas: banco x vendas, ou notas x vendas
  const bands = useMemo(() => {
    const other = fill === "bank" ? by("bank") : by("invoices");
    const s = by("sales");
    return other && s ? ribbons(s.values, other.values, x, y) : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curves, fill, w]);

  // rótulos no fim das linhas, afastados para não se sobreporem
  const ends = useMemo(() => {
    const raw = curves.map((c) => ({ c, y: y(c.values[n - 1] ?? 0) })).sort((p, q) => p.y - q.y);
    for (let i = 1; i < raw.length; i++) raw[i].y = Math.max(raw[i].y, raw[i - 1].y + 30);
    return raw;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curves, w]);

  // espelho do dia
  const mirrorTop = MAIN_H + AXIS_H;
  const mid = mirrorTop + MIRROR_H / 2;
  // um depósito grande não pode achatar o resto: o espelho tem teto de 3x o maior dia de venda e a barra cortada ganha uma seta
  const dayMax = Math.max(1, ...sales, ...invoices);
  const mirrorMax = axisTop(Math.min(Math.max(dayMax, ...(bank ?? [])), dayMax * 3));
  const half = MIRROR_H / 2 - 8;
  const barW = Math.max(2, Math.min(26, (pw / Math.max(n, 1)) * 0.72));
  const H = MAIN_H + AXIS_H + MIRROR_H + 4;

  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 62))));
  const move = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n))));
  };

  if (n === 0) return null;
  const hs = by("sales");
  const hb = by("bank");
  const hi = by("invoices");
  const tipLeft = hover !== null ? x(hover) / w : 0;

  return (
    <div ref={box} className="relative w-full min-w-0">
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        role="img"
        aria-label={`Vendas, notas fiscais${bank ? " e entradas no banco" : ""} acumuladas por dia: ${curves.map((c) => `${c.label} ${money(c.values[n - 1])}`).join(", ")}. ${found.length} cruzamento(s) entre as linhas.`}
        className="block touch-pan-y"
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <pattern id="conc-hatch-bad" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="7" height="7" fill="var(--c-bad)" opacity="0.07" />
            <line x1="0" y1="0" x2="0" y2="7" stroke="var(--c-bad)" strokeWidth="2.2" opacity="0.38" />
          </pattern>
          <pattern id="conc-hatch-info" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <rect width="7" height="7" fill="var(--c-total)" opacity="0.06" />
            <line x1="0" y1="0" x2="0" y2="7" stroke="var(--c-total)" strokeWidth="2.2" opacity="0.3" />
          </pattern>
        </defs>

        {/* grade */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={M.left} x2={w - M.right} y1={y(maxV * f)} y2={y(maxV * f)} stroke="var(--border)" strokeDasharray={f === 0 ? undefined : "2 4"} />
            <text x={M.left - 8} y={y(maxV * f) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
              {brlCompact.format(maxV * f)}
            </text>
          </g>
        ))}

        {/* faixas: o que ainda falta conciliar entre as duas linhas */}
        <g key={`${fill}-${n}`} className="conc-fade">
          {bands.map((b, i) => (
            <path
              key={i}
              d={`${path(b.pts)}Z`}
              fill={
                fill === "bank"
                  ? b.aboveIsA ? "var(--c-fixed)" : "var(--c-income)"
                  : b.aboveIsA ? "url(#conc-hatch-bad)" : "url(#conc-hatch-info)"
              }
              opacity={fill === "bank" ? (b.aboveIsA ? 0.22 : 0.18) : 1}
            />
          ))}
        </g>

        {/* os três fios */}
        {curves.map((c) => (
          <path
            key={`${c.key}-${n}-${c.values[n - 1]}`}
            d={path(c.values.map((v, i) => [x(i), y(v)] as Pt))}
            pathLength={1}
            fill="none"
            stroke={STYLE[c.key].color}
            strokeWidth={c.key === "bank" ? 3 : 2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="conc-line"
          />
        ))}

        {/* nós onde as linhas se cruzam */}
        {found.map((c, i) => {
          const px = x(c.index) + c.t * (x(c.index + 1) - x(c.index));
          const py = y(c.value);
          return (
            <g key={i}>
              <circle cx={px} cy={py} r={7} fill="none" stroke="var(--foreground)" strokeWidth={1.4} className="conc-pulse" />
              <circle cx={px} cy={py} r={4.5} fill="var(--background)" stroke="var(--foreground)" strokeWidth={2}>
                <title>{`${c.up} passou ${c.down} em ${fmtDateShort(c.date)}`}</title>
              </circle>
            </g>
          );
        })}

        {/* nome e valor direto no fim de cada linha */}
        {ends.map(({ c, y: ey }) => (
          <g key={c.key}>
            <line x1={x(n - 1)} x2={w - M.right + 6} y1={y(c.values[n - 1] ?? 0)} y2={ey} stroke={STYLE[c.key].color} strokeWidth={1} opacity={0.5} />
            <circle cx={x(n - 1)} cy={y(c.values[n - 1] ?? 0)} r={3.5} fill={STYLE[c.key].color} />
            <text x={w - M.right + 10} y={ey - 2} className="text-[11px] font-semibold" fill={STYLE[c.key].color}>{c.label}</text>
            <text x={w - M.right + 10} y={ey + 11} className="fill-muted-foreground text-[11px] tabular-nums">{brlCompact.format(c.values[n - 1] ?? 0)}</text>
          </g>
        ))}

        {/* eixo dos dias */}
        {days.map((d, i) =>
          i % labelEvery === 0 ? (
            <text key={d} x={x(i)} y={MAIN_H + 14} textAnchor="middle" className="fill-muted-foreground text-[11px]">{fmtDateShort(d)}</text>
          ) : null
        )}

        {/* espelho do dia: vendas para cima, banco para baixo */}
        <text x={M.left - 8} y={mid - half / 2} textAnchor="end" className="fill-muted-foreground text-[10px]">vendeu ↑</text>
        {bank && <text x={M.left - 8} y={mid + half / 2 + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">entrou ↓</text>}
        <line x1={M.left} x2={w - M.right} y1={mid} y2={mid} stroke="var(--border)" />
        {days.map((d, i) => {
          const sh = Math.min(sales[i] / mirrorMax, 1) * half;
          const ih = Math.min(invoices[i] / mirrorMax, 1) * half;
          const bh = bank ? Math.min(bank[i] / mirrorMax, 1) * half : 0;
          const cut = (sales[i] > mirrorMax ? 1 : 0) + (bank && bank[i] > mirrorMax ? 2 : 0);
          const dim = hover !== null && hover !== i ? 0.35 : 1;
          return (
            <g key={d} opacity={dim}>
              {sh > 0 && <rect x={x(i) - barW / 2} y={mid - sh} width={barW} height={sh} rx={2.5} fill={STYLE.sales.color} opacity={0.85} />}
              {ih > 0 && <rect x={x(i) - barW / 4} y={mid - ih} width={barW / 2} height={ih} rx={1.5} fill={STYLE.invoices.color} />}
              {bh > 0 && <rect x={x(i) - barW / 2} y={mid + 1} width={barW} height={bh} rx={2.5} fill={STYLE.bank.color} opacity={0.9} />}
              {(cut & 1) > 0 && <text x={x(i)} y={mid - half - 1} textAnchor="middle" className="fill-muted-foreground text-[9px]">▲</text>}
              {(cut & 2) > 0 && <text x={x(i)} y={mid + half + 9} textAnchor="middle" className="fill-muted-foreground text-[9px]">▼</text>}
            </g>
          );
        })}

        {/* leitura de um dia: régua, pontos e a distância entre vendas e banco */}
        {hover !== null && hs && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={mirrorTop + MIRROR_H} stroke="var(--foreground)" strokeOpacity={0.35} strokeDasharray="3 3" />
            {curves.map((c) => <circle key={c.key} cx={x(hover)} cy={y(c.values[hover])} r={4.5} fill={STYLE[c.key].color} stroke="var(--background)" strokeWidth={2} />)}
            {hb && (
              <g>
                <line x1={x(hover) + 7} x2={x(hover) + 7} y1={y(hs.values[hover])} y2={y(hb.values[hover])} stroke="var(--foreground)" strokeWidth={1.5} />
                <line x1={x(hover) + 3} x2={x(hover) + 11} y1={y(hs.values[hover])} y2={y(hs.values[hover])} stroke="var(--foreground)" strokeWidth={1.5} />
                <line x1={x(hover) + 3} x2={x(hover) + 11} y1={y(hb.values[hover])} y2={y(hb.values[hover])} stroke="var(--foreground)" strokeWidth={1.5} />
              </g>
            )}
          </g>
        )}
        <rect x={M.left} y={0} width={pw} height={H} fill="transparent" onPointerMove={move} onPointerDown={move} />
      </svg>

      {hover !== null && hs && (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-48 rounded-xl border bg-popover px-3 py-2 text-xs shadow-md"
          style={{ left: `${tipLeft * 100}%`, transform: `translateX(${tipLeft > 0.55 ? "calc(-100% - 14px)" : "14px"})` }}
        >
          <p className="mb-1 font-semibold">{fmtDateShort(days[hover])}</p>
          {curves.map((c) => (
            <p key={c.key} className="flex justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: STYLE[c.key].color }} />
                {c.label}
              </span>
              <span className="tabular-nums"><span className="font-medium">{money(c.values[hover])}</span> <span className="text-muted-foreground">(+{money({ sales, invoices, bank: bank ?? [] }[c.key][hover])})</span></span>
            </p>
          ))}
          {hb && <Gap pos="Vendido, não entrou" neg="Entrou além do vendido" a={hs.values[hover]} b={hb.values[hover]} />}
          {hi && <Gap pos="Vendido sem nota" neg="Notas além do vendido" a={hs.values[hover]} b={hi.values[hover]} />}
        </div>
      )}
    </div>
  );
}

function Gap({ pos, neg, a, b }: { pos: string; neg: string; a: number; b: number }) {
  const d = a - b;
  return (
    <p className="mt-1 flex justify-between gap-4 border-t pt-1">
      <span className="text-muted-foreground">{d >= 0 ? pos : neg}</span>
      <span className={`font-semibold tabular-nums ${d > 0.005 ? "text-[var(--c-fixed)]" : ""}`}>{money(Math.abs(d))}</span>
    </p>
  );
}
