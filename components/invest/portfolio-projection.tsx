"use client";

import { useMemo, useState } from "react";
import { Info, RotateCcw } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui-kit";
import type { Investment } from "@/components/finance-provider";
import { brl, monthLabel, monthKey, shiftMonth } from "@/lib/format";
import { growth, netValue, parseNumber, toPosition } from "@/lib/invest-projection";
import { Field, NumberInput, Segmented, Stat } from "./fields";
import { GrowthChart, type ChartPoint } from "./growth-chart";
import { useCdi } from "./use-cdi";

const HORIZONS = [
  { value: 6, label: "6 meses" },
  { value: 12, label: "1 ano" },
  { value: 24, label: "2 anos" },
  { value: 60, label: "5 anos" },
];

const horizonText = (m: number) => (m < 12 ? `${m} meses` : m === 12 ? "1 ano" : `${m / 12} anos`);

// Rendimento esperado das posições que já estão na carteira, uma a uma, com a taxa de cada CDB.
export function PortfolioProjection({
  positions,
  now,
}: {
  positions: Investment[];
  now: number;
}) {
  const { cdi, live, date } = useCdi();
  const [horizon, setHorizon] = useState(12);
  const [cdiText, setCdiText] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const cdiValue = cdiText === null ? cdi : parseNumber(cdiText);

  const model = useMemo(() => {
    const items = positions.map((inv) => {
      const { position, estimated } = toPosition(inv, now);
      return { inv, position, estimated };
    });
    // parte do saldo que o banco informa e soma só a evolução estimada
    const value = (i: (typeof items)[number], m: number) =>
      i.inv.balance + netValue(i.position, m, cdiValue) - netValue(i.position, 0, cdiValue);
    const total = (m: number) => items.reduce((s, i) => s + value(i, m), 0);
    const today = total(0);
    const series = Array.from({ length: horizon + 1 }, (_, m) => total(m));
    const weighted =
      items.reduce((s, i) => s + i.position.pctOfCdi * i.position.gross, 0) /
      Math.max(1, items.reduce((s, i) => s + i.position.gross, 0));
    return { items, today, series, weighted, value, estimated: items.some((i) => i.estimated) };
  }, [positions, now, cdiValue, horizon]);

  const baseKey = monthKey(new Date(now));
  const points: ChartPoint[] = model.series.map((v, m) => ({
    label: m === 0 ? "hoje" : monthLabel(shiftMonth(baseKey, m)),
    layers: [Math.max(0, v - model.today)],
    tip: [
      ["Rendimento líquido", brl.format(v - model.today)],
      ["Carteira estimada", brl.format(v)],
    ],
  }));

  const final = model.series[horizon];
  const gain = final - model.today;
  const firstMonth = model.series[1] - model.series[0];
  const rows = [...model.items]
    .sort((a, b) => b.position.gross - a.position.gross)
    .map((i) => {
      const end = model.value(i, horizon);
      const start = model.value(i, 0);
      return { ...i, start, end };
    });
  const visible = showAll ? rows : rows.slice(0, 6);

  return (
    <Panel className="mb-4 p-4 sm:p-6">
      <PanelHeader
        title="Projeção da carteira"
        subtitle="Quanto as suas posições atuais rendem se nada for resgatado nem somado"
      />
      <div className="mb-4 max-w-sm">
        <Segmented
          label="Prazo da projeção"
          value={horizon}
          options={HORIZONS}
          onChange={setHorizon}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Carteira hoje (líquida)" value={brl.format(model.today)} />
        <Stat
          label={`Em ${horizonText(horizon)}`}
          value={brl.format(final)}
          sub={`${(model.today > 0 ? gain / model.today : 0).toLocaleString("pt-BR", { style: "percent", maximumFractionDigits: 2 })} no período`}
        />
        <Stat label="Rendimento líquido no período" value={`+ ${brl.format(gain)}`} tone="good" />
        <Stat
          label="Rende por mês, em média"
          value={brl.format(horizon > 0 ? gain / horizon : 0)}
          sub={`1º mês: ${brl.format(firstMonth)}`}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div>
          <p className="mb-2 text-sm font-medium">Rendimento líquido acumulado</p>
          <GrowthChart
            points={points}
            layers={[{ name: "Rendimento líquido acumulado", color: "var(--c-income)" }]}
            summary={`Rendimento líquido projetado de ${brl.format(gain)} em ${horizonText(horizon)}, de ${brl.format(model.today)} para ${brl.format(final)}.`}
          />
        </div>

        <div className="min-w-0 space-y-4">
          <Field
            label="CDI projetado (% ao ano)"
            hint={
              live && date
                ? `CDI de hoje: ${cdi.toLocaleString("pt-BR")}% (Banco Central, ${date.split("-").reverse().join("/")}). Altere para simular outro cenário.`
                : "Valor padrão. Altere para simular outro cenário."
            }
          >
            <div className="flex gap-2">
              <NumberInput
                value={cdiText ?? String(cdi).replace(".", ",")}
                onChange={setCdiText}
                suffix="% a.a."
              />
              {cdiText !== null && (
                <button
                  type="button"
                  onClick={() => setCdiText(null)}
                  aria-label="Voltar ao CDI de hoje"
                  title="Voltar ao CDI de hoje"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw size={16} />
                </button>
              )}
            </div>
          </Field>
          <div className="rounded-2xl bg-muted/60 p-4 text-sm">
            <p className="text-xs text-muted-foreground">Rentabilidade média da carteira</p>
            <p className="mt-1 text-lg font-bold tabular-nums">
              {model.weighted.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do CDI
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              ≈ {(growth(12, cdiValue, model.weighted) - 1).toLocaleString("pt-BR", { style: "percent", maximumFractionDigits: 2 })} ao ano, antes do imposto
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-1 text-sm font-medium">Posição por posição</p>
        <div className="divide-y">
          {visible.map(({ inv, start, end, estimated }) => (
            <div key={inv.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {inv.subtype ?? "Renda fixa"}
                  {inv.rate ? ` ${inv.rate}% ${inv.rateType ?? ""}` : ""}
                  {estimated && <span className="text-muted-foreground"> (estimado)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {inv.dueDate
                    ? `vence em ${new Date(inv.dueDate).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric", timeZone: "UTC" })}`
                    : "sem vencimento informado"}
                  {" · hoje "}
                  {brl.format(start)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">{brl.format(end)}</p>
                <p className="text-xs tabular-nums text-good">+ {brl.format(end - start)}</p>
              </div>
            </div>
          ))}
        </div>
        {rows.length > 6 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-2 text-sm font-medium text-primary hover:underline"
          >
            {showAll ? "Mostrar menos" : `Ver as ${rows.length} posições`}
          </button>
        )}
      </div>

      <p className="mt-5 flex gap-2 text-xs text-muted-foreground">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Estimativa: considera o CDI constante, o imposto de renda regressivo (22,5% a 15%) e
          que o valor continua aplicado à mesma taxa depois do vencimento. Não inclui IOF
          {model.estimated && " e trata como 100% do CDI os títulos que não são pós-fixados"}.
          Rentabilidade passada não garante a futura; isso não é recomendação de investimento.
        </span>
      </p>
    </Panel>
  );
}
