import { ArrowRight, Bell, Check, Landmark, Tag, TrendingUp } from "lucide-react";
import { DEMO_MONTHS, brl0, expenseOf } from "./demo-data";

// previsão: contas fixas + parcelas já comprometidas
export function MiniForecast() {
  const more = [
    { label: "nov", fixed: 98000, card: 27000 },
    { label: "dez", fixed: 98000, card: 19000 },
    { label: "jan", fixed: 98000, card: 12000 },
    { label: "fev", fixed: 98000, card: 8000 },
  ];
  const max = Math.max(...more.map((m) => m.fixed + m.card));
  return (
    <div className="space-y-2.5">
      {more.map((m) => (
        <div key={m.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium">{m.label}</span>
            <span className="font-semibold tabular-nums">
              {brl0.format(m.fixed + m.card)}
            </span>
          </div>
          <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-l-full"
              style={{ width: `${(m.fixed / max) * 100}%`, background: "var(--c-fixed)" }}
            />
            <div
              className="h-full rounded-r-full"
              style={{ width: `${(m.card / max) * 100}%`, background: "var(--c-card)" }}
            />
          </div>
        </div>
      ))}
      <div className="flex gap-4 pt-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-sm" style={{ background: "var(--c-fixed)" }} />
          Contas fixas
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-sm" style={{ background: "var(--c-card)" }} />
          Parcelas
        </span>
      </div>
    </div>
  );
}

// o sistema aprende com a correção do usuário
export function MiniLearning() {
  const rows = [
    { name: "POSTO ALVORADA", from: "Compras", to: "Combustível" },
    { name: "SUPERMERCADO CENTRAL", from: "Compras", to: "Mercado" },
    { name: "IMOBILIARIA NORTE LTDA", from: "Serviços", to: "Aluguel" },
  ];
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div
          key={r.name}
          className="rounded-xl border bg-background/60 px-3 py-2 text-xs"
        >
          <p className="truncate font-medium">{r.name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
            <span className="line-through">{r.from}</span>
            <ArrowRight size={11} />
            <span className="flex items-center gap-1 font-semibold text-foreground">
              <Tag size={11} /> {r.to}
            </span>
          </p>
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground">
        Corrigiu uma vez? Vale para todos os lançamentos daquele fornecedor.
      </p>
    </div>
  );
}

export function MiniBanks() {
  const banks = ["Banco principal", "Banco da folha", "Cartão corporativo", "Conta de investimentos"];
  return (
    <ul className="space-y-2">
      {banks.map((b) => (
        <li
          key={b}
          className="flex items-center gap-2.5 rounded-xl border bg-background/60 px-3 py-2 text-xs"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/25">
            <Landmark size={13} />
          </span>
          <span className="flex-1 font-medium">{b}</span>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-good">
            <Check size={12} /> conectado
          </span>
        </li>
      ))}
    </ul>
  );
}

export function MiniAlerts() {
  const items = [
    { t: "Despesa 24% acima do mês anterior", s: "hoje", icon: TrendingUp },
    { t: "Vencimento de R$ 38 mil em 3 dias", s: "ontem", icon: Bell },
    { t: "Saldo abaixo do mínimo definido", s: "há 2 dias", icon: Bell },
  ];
  return (
    <ul className="space-y-2">
      {items.map((a) => (
        <li
          key={a.t}
          className="flex items-start gap-2.5 rounded-xl border bg-background/60 px-3 py-2 text-xs"
        >
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/25">
            <a.icon size={12} />
          </span>
          <span className="flex-1">
            <span className="block font-medium">{a.t}</span>
            <span className="text-[11px] text-muted-foreground">{a.s}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function MiniResult() {
  const rows = DEMO_MONTHS.filter((m) => !m.future).slice(-4);
  const max = Math.max(...rows.map((m) => Math.max(m.income, expenseOf(m))));
  return (
    <div className="grid grid-cols-4 gap-3">
      {rows.map((m) => {
        const exp = expenseOf(m);
        const res = m.income - exp;
        return (
          <div key={m.key} className="rounded-2xl border bg-background/60 p-3">
            <div className="flex h-28 items-end justify-center gap-1.5">
              <div
                className="w-5 rounded-t-md"
                style={{ height: `${(m.income / max) * 100}%`, background: "var(--c-income)" }}
              />
              <div
                className="w-5 rounded-t-md"
                style={{ height: `${(exp / max) * 100}%`, background: "var(--c-total)" }}
              />
            </div>
            <p className="mt-2 text-center text-[11px] font-medium text-muted-foreground">
              {m.label}
            </p>
            <p
              className="text-center text-xs font-bold tabular-nums"
              style={{ color: res >= 0 ? "var(--c-good)" : "var(--c-bad)" }}
            >
              {res >= 0 ? "▲ +" : "▼ −"}
              {Math.round(Math.abs(res) / 1000)}k
            </p>
          </div>
        );
      })}
    </div>
  );
}
