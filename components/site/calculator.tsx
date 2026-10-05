"use client";

import { useState } from "react";
import { brl0 } from "./demo-data";

const WEEKS_PER_MONTH = 52 / 12;

function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
  suffix: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span className="text-lg font-bold tabular-nums">
          {value.toLocaleString("pt-BR")}
          <span className="ml-1 text-xs font-medium text-muted-foreground">{suffix}</span>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[var(--ramp-3)]"
      />
    </div>
  );
}

export function Calculator() {
  const [hours, setHours] = useState(10);
  const [rate, setRate] = useState(60);
  const monthly = hours * WEEKS_PER_MONTH * rate;
  const yearly = monthly * 12;

  return (
    <div className="rounded-3xl border bg-card p-6 md:p-8">
      <div className="space-y-6">
        <NumberField
          id="calc-hours"
          label="Horas por semana consolidando o caixa"
          value={hours}
          onChange={setHours}
          min={1}
          max={60}
          step={1}
          suffix="h"
        />
        <NumberField
          id="calc-rate"
          label="Custo médio da hora do time"
          value={rate}
          onChange={setRate}
          min={20}
          max={300}
          step={5}
          suffix="R$/h"
        />
      </div>
      <div className="mt-7 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-primary/25 p-4">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Por mês
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{brl0.format(monthly)}</p>
        </div>
        <div className="rounded-2xl border bg-background/60 p-4">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Por ano
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{brl0.format(yearly)}</p>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Conta: horas por semana × 4,33 semanas × custo da hora. Considera só o
        tempo do time, sem erros de planilha ou decisões tomadas com números
        atrasados.
      </p>
      <a
        href="#diagnostico"
        className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-foreground px-6 text-base font-semibold text-background transition-opacity hover:opacity-90"
      >
        Quero reduzir esse custo
      </a>
    </div>
  );
}
