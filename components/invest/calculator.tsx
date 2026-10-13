"use client";

import { useMemo, useState } from "react";
import { Info, Wallet } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui-kit";
import { brl, monthKey, monthLabel, shiftMonth } from "@/lib/format";
import { monthlyForGoal, parseNumber, simulate } from "@/lib/invest-projection";
import { Field, NumberInput, Segmented, Stat } from "./fields";
import { GrowthChart, type ChartPoint } from "./growth-chart";
import { useCdi } from "./use-cdi";

type Kind = "cdb" | "lci";

const KINDS: { value: Kind; label: string }[] = [
  { value: "cdb", label: "CDB (com IR)" },
  { value: "lci", label: "LCI / LCA (isento)" },
];

const fmtInput = (n: number) => (n > 0 ? String(Math.round(n * 100) / 100).replace(".", ",") : "");

// Ambiente aberto de simulação: parte da carteira real, mas todos os campos são livres.
export function Calculator({
  portfolioValue,
  portfolioPctOfCdi,
  now,
}: {
  portfolioValue: number;
  portfolioPctOfCdi: number;
  now: number;
}) {
  const { cdi, live } = useCdi();
  const [initial, setInitial] = useState(() => fmtInput(portfolioValue));
  const [monthly, setMonthly] = useState("1000");
  const [unit, setUnit] = useState<"months" | "years">("years");
  const [span, setSpan] = useState("2");
  const [kind, setKind] = useState<Kind>("cdb");
  const [pctText, setPctText] = useState(() => String(Math.round(portfolioPctOfCdi) || 100));
  const [cdiText, setCdiText] = useState<string | null>(null);
  const [goalText, setGoalText] = useState("");

  const cdiValue = cdiText === null ? cdi : parseNumber(cdiText);
  const spanNumber = parseNumber(span);
  const months = Math.min(600, Math.max(1, Math.round(unit === "years" ? spanNumber * 12 : spanNumber)));
  const input = {
    initial: parseNumber(initial),
    months,
    cdiAnnual: cdiValue,
    pctOfCdi: parseNumber(pctText),
    exempt: kind === "lci",
  };
  const monthlyValue = parseNumber(monthly);
  const goal = parseNumber(goalText);

  const series = useMemo(
    () => simulate({ ...input, monthly: monthlyValue }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input.initial, input.months, input.cdiAnnual, input.pctOfCdi, input.exempt, monthlyValue]
  );
  const end = series[series.length - 1];
  const needed = useMemo(
    () => (goal > 0 ? monthlyForGoal(goal, input) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goal, input.initial, input.months, input.cdiAnnual, input.pctOfCdi, input.exempt]
  );

  const baseKey = monthKey(new Date(now));
  const points: ChartPoint[] = series.map((p) => ({
    label: p.month === 0 ? "hoje" : monthLabel(shiftMonth(baseKey, p.month)),
    layers: [p.invested, Math.max(0, p.net - p.invested)],
    tip: [
      ["Total aplicado", brl.format(p.invested)],
      ["Rendimento líquido", brl.format(p.net - p.invested)],
      ["Valor líquido", brl.format(p.net)],
    ],
  }));

  const gainNet = end.net - end.invested;
  const annualNet =
    end.invested > 0 && months >= 12
      ? Math.pow(end.net / end.invested, 12 / months) - 1
      : null;
  const spanText =
    months % 12 === 0 && months >= 12
      ? `${months / 12} ${months === 12 ? "ano" : "anos"}`
      : `${months} ${months === 1 ? "mês" : "meses"}`;

  return (
    <Panel className="mb-4 p-4 sm:p-6">
      <PanelHeader
        title="Calculadora de investimentos"
        subtitle="Simule qualquer valor, aporte e prazo. Começa com a sua carteira, mas tudo pode ser alterado"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <div className="min-w-0 space-y-4">
          <Field
            label="Valor inicial"
            hint={
              portfolioValue > 0 && (
                <button
                  type="button"
                  onClick={() => setInitial(fmtInput(portfolioValue))}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <Wallet size={11} /> usar minha carteira ({brl.format(portfolioValue)})
                </button>
              )
            }
          >
            <NumberInput value={initial} onChange={setInitial} prefix="R$" placeholder="0,00" />
          </Field>
          <Field label="Aporte mensal">
            <NumberInput value={monthly} onChange={setMonthly} prefix="R$" placeholder="0,00" />
          </Field>
          <Field label="Prazo">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <NumberInput value={span} onChange={setSpan} />
              <Segmented
                label="Unidade do prazo"
                value={unit}
                options={[
                  { value: "months", label: "meses" },
                  { value: "years", label: "anos" },
                ]}
                onChange={setUnit}
              />
            </div>
          </Field>
          <Field label="Tipo de aplicação">
            <Segmented label="Tipo de aplicação" value={kind} options={KINDS} onChange={setKind} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rentabilidade">
              <NumberInput value={pctText} onChange={setPctText} suffix="% CDI" />
            </Field>
            <Field
              label="CDI ao ano"
              hint={cdiText === null ? (live ? "hoje, Banco Central" : "valor padrão") : undefined}
            >
              <NumberInput
                value={cdiText ?? String(cdi).replace(".", ",")}
                onChange={setCdiText}
                suffix="%"
              />
            </Field>
          </div>
          <Field
            label="Meta (opcional)"
            hint="Quanto quer ter ao final do prazo. Mostramos quanto aportar por mês."
          >
            <NumberInput value={goalText} onChange={setGoalText} prefix="R$" placeholder="ex.: 100000" />
          </Field>
        </div>

        <div className="min-w-0">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3 rounded-2xl bg-primary/10 p-5">
              <p className="text-xs text-muted-foreground">Valor líquido em {spanText}</p>
              <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight">
                {brl.format(end.net)}
              </p>
              {annualNet !== null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  ≈ {annualNet.toLocaleString("pt-BR", { style: "percent", maximumFractionDigits: 2 })} ao ano líquido
                </p>
              )}
            </div>
            <Stat label="Total aplicado" value={brl.format(end.invested)} />
            <Stat label="Rendimento líquido" value={`+ ${brl.format(gainNet)}`} tone="good" />
            <Stat
              label={kind === "lci" ? "Imposto (isento)" : "Imposto de renda"}
              value={brl.format(end.tax)}
            />
          </div>

          {needed !== null && (
            <p className="mt-3 rounded-2xl border border-dashed p-4 text-sm">
              {needed <= 0 ? (
                <>
                  Só com o valor inicial você já chega a <strong>{brl.format(goal)}</strong> em {spanText}.
                </>
              ) : (
                <>
                  Para chegar a <strong>{brl.format(goal)}</strong> em {spanText}, aporte{" "}
                  <strong>{brl.format(needed)}</strong> por mês.
                </>
              )}
            </p>
          )}

          <div className="mt-5">
            <GrowthChart
              points={points}
              layers={[
                { name: "Total aplicado", color: "var(--c-total)" },
                { name: "Rendimento líquido", color: "var(--c-income)" },
              ]}
              summary={`Simulação: ${brl.format(end.invested)} aplicados viram ${brl.format(end.net)} líquidos em ${spanText}.`}
            />
          </div>
        </div>
      </div>

      <p className="mt-5 flex gap-2 text-xs text-muted-foreground">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Simulação com CDI constante, aportes no fim de cada mês e imposto de renda regressivo
          calculado por aporte (o valor inicial conta como dinheiro novo, sem desconto de tempo
          já aplicado). Não inclui IOF. Não é recomendação de investimento.
        </span>
      </p>
    </Panel>
  );
}
