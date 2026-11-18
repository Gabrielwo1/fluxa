import { ArrowDown, ArrowRight, ArrowUp, Check, PackageCheck, TriangleAlert } from "lucide-react";

// Visuais da página para MEI. Todos os números e nomes são fictícios, só para ilustrar.
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-background/60 p-4">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

const Pill = ({ tone, children }: { tone: "good" | "bad" | "muted"; children: React.ReactNode }) => (
  <span
    className={
      "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold " +
      (tone === "bad"
        ? "bg-bad/15 text-bad"
        : tone === "good"
          ? "bg-primary/30 text-foreground"
          : "bg-muted text-muted-foreground")
    }
  >
    {children}
  </span>
);

export function HeroCard() {
  const debts = [
    { who: "Mariana", what: "Encomenda de bolo", when: "vence hoje", value: 180, tone: "good" as const },
    { who: "Loja Bela Vista", what: "Parcela 2 de 3", when: "vence dia 25", value: 640, tone: "muted" as const },
    { who: "Carlos", what: "Fiado da semana", when: "atrasou 6 dias", value: 95, tone: "bad" as const },
  ];
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="rounded-[2rem] border bg-card p-5 shadow-xl md:p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Seu mês</p>
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">novembro</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Stat label="Vendi" value={brl.format(4820)} />
          <Stat label="Gastei" value={brl.format(2310)} />
        </div>
        <div className="mt-3 rounded-2xl bg-primary/30 p-4">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Sobrou</p>
          <p className="mt-1 flex items-center gap-2 text-3xl font-bold tabular-nums">
            <ArrowUp size={22} className="text-good" aria-hidden /> + {brl.format(2510)}
          </p>
        </div>
        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Quem te deve</p>
        <ul className="space-y-2">
          {debts.map((d) => (
            <li key={d.who} className="flex items-center justify-between gap-3 rounded-2xl border bg-background/60 px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{d.who}</span>
                <span className="block truncate text-xs text-muted-foreground">{d.what}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-sm font-bold tabular-nums">{brl.format(d.value)}</span>
                <Pill tone={d.tone}>{d.when}</Pill>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">Exemplo com dados fictícios</p>
      </div>
      <div
        aria-hidden
        className="absolute -right-6 -top-4 hidden animate-[float_6s_ease-in-out_infinite] items-center gap-2.5 rounded-2xl border bg-card px-3.5 py-2.5 text-xs shadow-xl xl:flex"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/30">
          <PackageCheck size={15} />
        </span>
        <span>
          <span className="block font-semibold">Venda registrada</span>
          <span className="text-muted-foreground">Estoque baixou 3 unidades</span>
        </span>
      </div>
      <div
        aria-hidden
        className="absolute -bottom-4 -left-6 hidden animate-[float_7s_ease-in-out_infinite_1s] items-center gap-2.5 rounded-2xl border bg-card px-3.5 py-2.5 text-xs shadow-xl xl:flex"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bad/15">
          <TriangleAlert size={15} className="text-bad" />
        </span>
        <span>
          <span className="block font-semibold">Cliente atrasou</span>
          <span className="text-muted-foreground">Carlos, há 6 dias</span>
        </span>
      </div>
    </div>
  );
}

// "isto acontece, depois isto, depois aquilo": o que o sistema faz sozinho
export function MiniFlow({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-3 rounded-2xl border bg-background/60 px-3.5 py-2.5 text-sm">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            {i === 0 ? <Check size={13} strokeWidth={3} /> : <ArrowRight size={13} />}
          </span>
          {s}
        </li>
      ))}
    </ol>
  );
}

export function MiniReceber() {
  const rows = [
    { who: "Mariana", value: 180, label: "Hoje", tone: "good" as const },
    { who: "Loja Bela Vista", value: 640, label: "Em 3 dias", tone: "muted" as const },
    { who: "Carlos", value: 95, label: "Atrasado", tone: "bad" as const },
  ];
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.who} className="flex items-center justify-between gap-3 text-sm">
          <span className="min-w-0 truncate font-medium">{r.who}</span>
          <span className="flex items-center gap-2">
            <span className="font-semibold tabular-nums">{brl.format(r.value)}</span>
            <Pill tone={r.tone}>{r.label}</Pill>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function MiniMes() {
  const rows = [
    { label: "Vendi", value: 4820, color: "var(--c-fixed)" },
    { label: "Custo do que vendi", value: 1700, color: "var(--c-card)" },
    { label: "Despesas", value: 610, color: "var(--c-card)" },
  ];
  const max = rows[0].value;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium">{r.label}</span>
            <span className="font-semibold tabular-nums">{brl.format(r.value)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
          </div>
        </div>
      ))}
      <p className="flex items-center gap-1.5 pt-1 text-sm font-bold">
        <ArrowUp size={15} className="text-good" aria-hidden /> Sobrou + {brl.format(2510)}
      </p>
    </div>
  );
}

export function MiniProjecao() {
  const months = [
    { label: "dez", value: 1900 },
    { label: "jan", value: -400 },
    { label: "fev", value: 1200 },
  ];
  return (
    <ul className="space-y-2">
      {months.map((m) => {
        const up = m.value >= 0;
        return (
          <li key={m.label} className="flex items-center justify-between rounded-2xl border bg-background/60 px-3.5 py-2.5 text-sm">
            <span className="font-medium">{m.label}</span>
            <span className={"flex items-center gap-1.5 font-bold tabular-nums " + (up ? "" : "text-bad")}>
              {up ? <ArrowUp size={14} className="text-good" aria-hidden /> : <ArrowDown size={14} aria-hidden />}
              {up ? "+" : "−"} {brl.format(Math.abs(m.value))}
            </span>
          </li>
        );
      })}
      <li className="pt-1 text-xs text-muted-foreground">Parcelas a receber e contas fixas já lançadas.</li>
    </ul>
  );
}

export function MiniMargem() {
  const rows = [
    { name: "Bolo de pote", pct: 62 },
    { name: "Brigadeiro gourmet", pct: 48 },
    { name: "Caixa presente", pct: 31 },
  ];
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.name}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium">{r.name}</span>
            <span className="font-semibold tabular-nums">{r.pct}% de margem</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: "var(--c-fixed)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
