"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, Tag } from "lucide-react";
import { Panel, PanelHeader, PageLink, Trend } from "@/components/ui-kit";
import { useFinance } from "@/components/finance-provider";
import { brl, monthLabel, pct, shiftMonth, splitDescription } from "@/lib/format";
import { translateCategory } from "@/lib/categories";
import { CategoryBadge } from "@/lib/icons";
import { CATEGORY_OPTIONS } from "@/lib/segments";
import { cn } from "@/lib/utils";

// coluna de indicadores ao lado do gráfico principal
export function StatsColumn() {
  const { cur, prev } = useFinance();
  const items = [
    {
      label: cur.future ? "Entradas" : "Total de entradas",
      value: cur.future ? "—" : brl.format(cur.income),
      trend: cur.future ? null : (
        <Trend current={cur.income} previous={prev.income} />
      ),
    },
    {
      label: cur.future ? "Despesa prevista" : "Total de despesas",
      value: brl.format(cur.expense),
      trend: cur.future ? (
        <p className="text-xs text-muted-foreground">fixas + parcelas</p>
      ) : (
        <Trend current={cur.expense} previous={prev.expense} goodWhenUp={false} />
      ),
    },
    {
      label: "Aplicado em investimentos",
      value: brl.format(cur.invest),
      trend: cur.future ? null : (
        <Trend current={cur.invest} previous={prev.invest} />
      ),
    },
  ];
  return (
    <Panel className="flex flex-col justify-between gap-5 p-6">
      {items.map((it, i) => (
        <div
          key={it.label}
          className={cn(i > 0 && "border-t pt-5")}
        >
          <p className="text-sm text-muted-foreground">{it.label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">
            {it.value}
          </p>
          <div className="mt-1">{it.trend}</div>
        </div>
      ))}
    </Panel>
  );
}

// despesa x entradas, no estilo "limite mensal de gastos"
export function SpendingLimitCard() {
  const { cur } = useFinance();
  const share = pct(cur.expense, cur.income);
  const width = Math.min(100, share ?? 0);
  return (
    <Panel>
      <PanelHeader
        title="Despesa vs entradas"
        subtitle={cur.future ? "mês previsto" : "quanto das entradas já foi gasto"}
      />
      {cur.future || cur.income <= 0 ? (
        <p className="text-sm text-muted-foreground">
          {cur.future
            ? "Meses futuros ainda não têm entradas lançadas."
            : "Nenhuma entrada registrada neste mês."}
        </p>
      ) : (
        <>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold tabular-nums">
              {share}%
            </span>
            <span className="text-xs text-muted-foreground">
              {brl.format(cur.expense)} de {brl.format(cur.income)}
            </span>
          </div>
          <div
            className="h-4 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={Math.round(width)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Despesa em relação às entradas"
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${width}%`,
                background:
                  (share ?? 0) > 100 ? "var(--c-bad)" : "var(--ramp-3)",
              }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] tabular-nums text-muted-foreground">
            <span>R$ 0</span>
            <span>{brl.format(cur.income)}</span>
          </div>
          {(share ?? 0) > 100 && (
            <p className="mt-2 text-xs font-medium text-bad">
              ▼ Despesas passaram das entradas em {(share ?? 0) - 100}%.
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

// resumo em texto gerado a partir dos números do mês
export function InsightCard() {
  const { cur, prev, segments, segmentsTotal, selectedMonth } = useFinance();
  const label = monthLabel(selectedMonth);
  const top = segments[0];

  const lines: string[] = [];
  if (cur.future) {
    lines.push(
      `Em ${label} já estão comprometidos ${brl.format(cur.expense)} entre contas fixas (${brl.format(cur.fixed)}) e parcelas do cartão (${brl.format(cur.card)}).`
    );
  } else {
    if (top && segmentsTotal > 0) {
      lines.push(
        `Seu maior gasto em ${label} é ${top.seg.label} — ${brl.format(top.total)}, ${Math.round((top.total / segmentsTotal) * 100)}% do total.`
      );
    }
    if (prev.expense > 0) {
      const diff = Math.round(((cur.expense - prev.expense) / prev.expense) * 100);
      lines.push(
        `A despesa total está ${Math.abs(diff)}% ${diff >= 0 ? "acima" : "abaixo"} de ${monthLabel(shiftMonth(selectedMonth, -1))}.`
      );
    }
    if (lines.length === 0) lines.push("Sem lançamentos suficientes neste mês para gerar um resumo.");
  }

  return (
    <Panel className="relative overflow-hidden bg-primary/20 dark:bg-primary/15">
      <h2 className="mb-2 text-base font-semibold">Resumo de {label}</h2>
      <div className="relative z-10 max-w-md space-y-1 text-sm text-foreground/80">
        {lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
      <Link
        href="/transacoes"
        className="relative z-10 mt-4 inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline"
      >
        Ver transações →
      </Link>
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-4 -right-2 grid grid-cols-4 gap-1.5 opacity-80"
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="h-8 w-8 rounded-lg"
            style={{
              background: `var(--ramp-${(i % 4) + 2})`,
              opacity: 0.25 + ((i * 7) % 5) * 0.12,
            }}
          />
        ))}
      </div>
    </Panel>
  );
}

const RAMP = ["var(--ramp-1)", "var(--ramp-2)", "var(--ramp-3)", "var(--ramp-4)", "var(--ramp-5)"];

// segmentos de gasto: barra segmentada + lista; cada segmento abre em
// subcategorias e, dentro delas, cada lançamento com nome e valor
export function CostAnalysisCard() {
  const { segments, segmentsTotal, selectedMonth, cur, rules, setCategoryRule } =
    useFinance();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      segments.map((s, i) => ({
        ...s,
        color: i < RAMP.length ? RAMP[i] : "var(--ramp-rest)",
        share: segmentsTotal > 0 ? (s.total / segmentsTotal) * 100 : 0,
      })),
    [segments, segmentsTotal]
  );
  const shown = expanded ? rows : rows.slice(0, 6);

  return (
    <Panel>
      <PanelHeader
        title="Para onde vai o dinheiro"
        subtitle={`${monthLabel(selectedMonth)}${cur.future ? " · previsto" : ""}`}
      />
      <p className="text-3xl font-bold tabular-nums tracking-tight">
        {brl.format(segmentsTotal)}
      </p>
      <p className="mb-4 text-xs text-muted-foreground">em gastos (cartão + conta)</p>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum gasto lançado neste mês.</p>
      ) : (
        <>
          <div
            className="mb-4 flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label="Participação de cada segmento nos gastos"
          >
            {rows.map((r) => (
              <div
                key={r.seg.id}
                title={`${r.seg.label}: ${brl.format(r.total)}`}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${r.share}%`, background: r.color }}
              />
            ))}
          </div>
          <div className="space-y-1">
            {shown.map((r) => {
              const isOpen = open === r.seg.id;
              const cats = Array.from(r.cats.entries())
                .filter(([, c]) => c.total !== 0)
                .sort((a, b) => b[1].total - a[1].total);
              return (
                <div key={r.seg.id}>
                  <button
                    onClick={() => setOpen(isOpen ? null : r.seg.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-1.5 py-1.5 text-left transition-colors hover:bg-muted/70",
                      isOpen && "bg-muted/50"
                    )}
                    aria-expanded={isOpen}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${r.seg.tint}`}
                    >
                      <r.seg.Icon size={16} strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {r.seg.label}
                      </span>
                      <span className="block text-[11px] tabular-nums text-muted-foreground">
                        {brl.format(r.total)}
                      </span>
                    </span>
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ background: r.color }}
                      aria-hidden
                    />
                    <span className="w-9 text-right text-sm font-semibold tabular-nums">
                      {Math.round(r.share)}%
                    </span>
                    <ChevronDown
                      size={14}
                      className={cn(
                        "shrink-0 text-muted-foreground transition-transform",
                        isOpen && "rotate-180"
                      )}
                    />
                  </button>

                  {isOpen && (
                    <div className="mb-2 ml-4 mt-1 max-h-96 space-y-3 overflow-y-auto border-l pl-4 pr-1">
                      {cats.map(([cat, c]) => (
                        <div key={cat}>
                          <div className="mb-1 flex items-center gap-2">
                            <CategoryBadge category={cat} size={6} />
                            <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                              {translateCategory(cat)}
                              <span
                                className="ml-1.5 font-normal text-muted-foreground"
                                title={`${c.items.length} lançamentos`}
                              >
                                ({c.items.length})
                              </span>
                            </span>
                            <span className="text-xs font-semibold tabular-nums">
                              {brl.format(c.total)}
                            </span>
                          </div>
                          <ul className="space-y-0.5">
                            {[...c.items]
                              .sort((a, b) => b.value - a.value)
                              .map((it) => {
                                const d = splitDescription(it.description);
                                return (
                                <li key={it.id} className="group">
                                  <div className="flex items-baseline justify-between gap-2 text-xs">
                                    <span className="min-w-0 flex-1">
                                      <span
                                        className="block truncate text-foreground/90"
                                        title={it.description}
                                      >
                                        {d.title}
                                      </span>
                                      <span className="block truncate text-[10.5px] text-muted-foreground">
                                        {new Date(it.date).toLocaleDateString("pt-BR", {
                                          day: "2-digit",
                                          month: "short",
                                        })}
                                        {it.channel === "card" ? " · cartão" : " · conta"}
                                        {d.kind ? ` · ${d.kind.toLowerCase()}` : ""}
                                        {it.value < 0 ? " · estorno" : ""}
                                        {rules[it.merchant] ? " · regra sua" : ""}
                                      </span>
                                    </span>
                                    <span
                                      className={cn(
                                        "shrink-0 tabular-nums",
                                        it.value < 0 && "text-good"
                                      )}
                                    >
                                      {it.value < 0 ? "+" : ""}
                                      {brl.format(Math.abs(it.value))}
                                    </span>
                                    <button
                                      onClick={() =>
                                        setEditing(editing === it.id ? null : it.id)
                                      }
                                      className={cn(
                                        "shrink-0 self-center rounded p-0.5 text-muted-foreground/50 transition hover:bg-muted hover:text-foreground",
                                        editing === it.id && "bg-muted text-foreground"
                                      )}
                                      aria-label={`Alterar a categoria de ${d.title}`}
                                      title="Alterar a categoria deste estabelecimento"
                                    >
                                      <Tag size={12} />
                                    </button>
                                  </div>
                                  {editing === it.id && (
                                    <div className="mb-1 mt-1 rounded-lg border bg-background/60 p-2">
                                      <label className="mb-1 block text-[10.5px] text-muted-foreground">
                                        Sempre classificar “{d.title}” como:
                                      </label>
                                      <select
                                        className="w-full rounded-md border bg-card px-2 py-1.5 text-xs outline-none focus:border-primary"
                                        value={rules[it.merchant] ?? ""}
                                        onChange={async (e) => {
                                          await setCategoryRule(
                                            it.merchant,
                                            e.target.value || null
                                          );
                                          setEditing(null);
                                        }}
                                      >
                                        <option value="">Automático</option>
                                        {CATEGORY_OPTIONS.map((g) => (
                                          <optgroup key={g.label} label={g.label}>
                                            {g.categories.map((c) => (
                                              <option key={c} value={c}>
                                                {translateCategory(c)}
                                              </option>
                                            ))}
                                          </optgroup>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                </li>
                                );
                              })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {rows.length > 6 && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="mt-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              {expanded ? "Ver menos" : `Ver todos (${rows.length})`}
            </button>
          )}
        </>
      )}
    </Panel>
  );
}

// semicírculo segmentado com a taxa de poupança do mês
export function HealthCard() {
  const { cur, selectedMonth } = useFinance();
  const hasData = !cur.future && cur.income > 0;
  const rate = hasData ? (cur.income - cur.expense) / cur.income : 0;
  const filled = Math.max(0, Math.min(1, rate));
  const N = 28;
  const cx = 110;
  const cy = 105;
  const r1 = 62;
  const r2 = 92;

  return (
    <Panel>
      <PanelHeader
        title="Saúde financeira"
        subtitle={`taxa de poupança · ${monthLabel(selectedMonth)}`}
      />
      <div className="flex flex-col items-center">
        <svg
          viewBox="0 0 220 120"
          className="w-full max-w-64"
          role="img"
          aria-label={
            hasData
              ? `Taxa de poupança de ${Math.round(rate * 100)}%`
              : "Sem dados para a taxa de poupança"
          }
        >
          {Array.from({ length: N }).map((_, i) => {
            const a = Math.PI - (Math.PI * (i + 0.5)) / N;
            const on = (i + 0.5) / N <= filled && hasData;
            return (
              <line
                key={i}
                x1={cx + r1 * Math.cos(a)}
                y1={cy - r1 * Math.sin(a)}
                x2={cx + r2 * Math.cos(a)}
                y2={cy - r2 * Math.sin(a)}
                strokeWidth={5.5}
                strokeLinecap="round"
                style={{
                  stroke: on ? "var(--ramp-3)" : "var(--muted)",
                }}
              />
            );
          })}
          <text
            x={cx}
            y={cy - 8}
            textAnchor="middle"
            fontSize={30}
            fontWeight={700}
            fill="currentColor"
          >
            {hasData ? `${Math.round(rate * 100)}%` : "—"}
          </text>
        </svg>
        <p className="-mt-1 text-center text-xs text-muted-foreground">
          {hasData
            ? rate >= 0
              ? "do que entrou sobrou no mês"
              : "as despesas passaram das entradas"
            : cur.future
              ? "disponível para meses já fechados"
              : "sem entradas neste mês"}
        </p>
        {hasData && (
          <div className="mt-4 grid w-full grid-cols-2 gap-3 border-t pt-3 text-center">
            <div>
              <p className="text-[11px] text-muted-foreground">Entradas</p>
              <p className="text-sm font-semibold tabular-nums">{brl.format(cur.income)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Despesas</p>
              <p className="text-sm font-semibold tabular-nums">{brl.format(cur.expense)}</p>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

// resumo das contas fixas (gerenciamento fica na página própria)
export function FixedBillsCard() {
  const { bills, fixedTotal } = useFinance();
  const sorted = [...bills].sort((a, b) => b.amount - a.amount).slice(0, 5);
  return (
    <Panel>
      <PanelHeader
        title="Contas fixas"
        subtitle="entram na previsão a partir do próximo mês"
        right={<PageLink href="/contas-fixas">Gerenciar</PageLink>}
      />
      <p className="mb-4 text-3xl font-bold tabular-nums tracking-tight">
        {brl.format(fixedTotal)}
        <span className="ml-1 text-sm font-medium text-muted-foreground">/mês</span>
      </p>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma conta fixa cadastrada.</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((b) => (
            <div key={b.id}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{b.name}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {brl.format(b.amount)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${fixedTotal > 0 ? (b.amount / fixedTotal) * 100 : 0}%`,
                    background: "var(--c-fixed)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
