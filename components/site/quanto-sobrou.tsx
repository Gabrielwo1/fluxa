"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// Limite anual do MEI hoje: R$ 81 mil, ou R$ 6.750 por mês em média.
const MEI_MONTHLY = 81000 / 12;

function Slider({
  id,
  label,
  value,
  onChange,
  max,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  max: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span className="text-lg font-bold tabular-nums">{brl.format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={max}
        step={50}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[var(--ramp-3)]"
      />
    </div>
  );
}

function Result({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  const up = value >= 0;
  return (
    <div className={strong ? "rounded-2xl bg-primary/30 p-4" : "rounded-2xl border bg-background/60 p-4"}>
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={"mt-1 flex items-center gap-1.5 text-2xl font-bold tabular-nums " + (up ? "" : "text-bad")}>
        {up ? <ArrowUp size={18} className="text-good" aria-hidden /> : <ArrowDown size={18} aria-hidden />}
        {up ? "+" : "−"} {brl.format(Math.abs(value))}
      </p>
    </div>
  );
}

export function QuantoSobrou() {
  const [sales, setSales] = useState(6000);
  const [cost, setCost] = useState(2500);
  const [expenses, setExpenses] = useState(1200);
  const [withdrawal, setWithdrawal] = useState(1500);

  const left = sales - cost - expenses;
  const afterWithdrawal = left - withdrawal;
  const limitPct = Math.round((sales / MEI_MONTHLY) * 100);

  return (
    <div className="rounded-3xl border bg-card p-6 md:p-8">
      <div className="space-y-5">
        <Slider id="qs-sales" label="Vendas do mês" value={sales} onChange={setSales} max={20000} />
        <Slider id="qs-cost" label="Custo do que você vendeu" value={cost} onChange={setCost} max={20000} />
        <Slider id="qs-exp" label="Despesas do negócio (aluguel, internet, embalagem…)" value={expenses} onChange={setExpenses} max={10000} />
        <Slider id="qs-wd" label="Quanto você tirou para você" value={withdrawal} onChange={setWithdrawal} max={10000} />
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <Result label="Sobrou no negócio" value={left} strong />
        <Result label="Depois da sua retirada" value={afterWithdrawal} />
      </div>
      <div className="mt-5">
        <div className="mb-1.5 flex justify-between text-xs">
          <span className="font-medium">Vendas deste mês vs. média mensal do limite do MEI</span>
          <span className="font-semibold tabular-nums">{limitPct}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${limitPct}% da média mensal do limite do MEI`}>
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(limitPct, 100)}%`, background: limitPct > 100 ? "var(--c-bad)" : "var(--c-fixed)" }}
          />
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        O limite do MEI hoje é de R$ 81 mil por ano, o que dá R$ 6.750 por mês em média. O que vale é o total do
        ano; confirme os valores atuais no Portal do Empreendedor. Conta simples, só para dar uma ideia.
      </p>
      <a
        href="#acesso"
        className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-foreground px-6 text-base font-semibold text-background transition-opacity hover:opacity-90"
      >
        Quero ver isso sem planilha
      </a>
    </div>
  );
}
