"use client";

import { useState } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, GitBranch, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  {
    id: "aprovacao",
    label: "Aprovação de pagamentos",
    Icon: GitBranch,
    title: "O seu fluxo de aprovação vira uma etapa do sistema",
    text: "Quem solicita, quem aprova e o que precisa de uma segunda assinatura acima de certo valor. Cada pagamento mostra em que etapa está.",
  },
  {
    id: "custos",
    label: "Centros de custo",
    Icon: Layers,
    title: "Cada despesa no centro de custo certo",
    text: "Regras por fornecedor, valor ou conta mandam o lançamento para a área responsável. Corrigiu uma vez, o sistema aplica nas próximas.",
  },
  {
    id: "calendario",
    label: "Calendário de pagamentos",
    Icon: CalendarDays,
    title: "Vencimentos cruzados com o saldo previsto",
    text: "Folha, tributos e fornecedores num calendário só, comparados ao que deve estar na conta em cada data.",
  },
];

function Approval() {
  const steps = ["Solicitado", "Aprovação do gestor", "Aprovação financeira", "Pago"];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                i < 2 ? "border-transparent bg-primary text-primary-foreground" : "bg-background"
              )}
            >
              {s}
            </span>
            {i < steps.length - 1 && <ArrowRight size={13} className="text-muted-foreground" />}
          </span>
        ))}
      </div>
      <div className="rounded-2xl border bg-background/60 p-4 text-sm">
        <p className="font-semibold">Fornecedor de materiais — R$ 18.400</p>
        <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
          <CheckCircle2 size={14} className="text-good" /> Aprovado pelo gestor · aguardando financeiro
        </p>
      </div>
    </div>
  );
}

function CostCenters() {
  const rows = [
    ["Operação", 46],
    ["Comercial", 24],
    ["Administrativo", 18],
    ["Tecnologia", 12],
  ] as const;
  return (
    <div className="space-y-3">
      {rows.map(([n, v]) => (
        <div key={n}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-medium">{n}</span>
            <span className="font-semibold tabular-nums">{v}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${v * 2}%`, background: "var(--ramp-3)" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarMock() {
  const days = [
    ["05", "Folha de pagamento", "R$ 112.000"],
    ["10", "Fornecedores", "R$ 64.300"],
    ["20", "Tributos", "R$ 38.900"],
    ["28", "Aluguel e estrutura", "R$ 29.500"],
  ];
  return (
    <ul className="space-y-2">
      {days.map(([d, n, v]) => (
        <li key={d} className="flex items-center gap-3 rounded-2xl border bg-background/60 px-3 py-2.5 text-sm">
          <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/25 text-sm font-bold leading-none">
            {d}
          </span>
          <span className="flex-1 font-medium">{n}</span>
          <span className="font-semibold tabular-nums">{v}</span>
        </li>
      ))}
    </ul>
  );
}

export function CustomTabs() {
  const [active, setActive] = useState(TABS[0].id);
  const tab = TABS.find((t) => t.id === active) ?? TABS[0];
  return (
    <div className="mt-10">
      <div
        role="tablist"
        aria-label="Exemplos de rotinas modeladas"
        className="mb-6 flex flex-wrap gap-2"
      >
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-selected={active === id}
            aria-controls={`panel-${id}`}
            onClick={() => setActive(id)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors",
              active === id
                ? "border-transparent bg-primary text-primary-foreground"
                : "bg-card hover:bg-muted"
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`panel-${tab.id}`}
        aria-labelledby={`tab-${tab.id}`}
        className="grid gap-8 rounded-3xl border bg-card p-6 md:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center"
      >
        <div>
          <h3 className="text-2xl font-bold tracking-tight">{tab.title}</h3>
          <p className="mt-3 leading-relaxed text-muted-foreground">{tab.text}</p>
          <a
            href="#diagnostico"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"
          >
            Quero isso no meu financeiro <ArrowRight size={15} />
          </a>
        </div>
        <div className="rounded-2xl bg-muted/50 p-5">
          {tab.id === "aprovacao" && <Approval />}
          {tab.id === "custos" && <CostCenters />}
          {tab.id === "calendario" && <CalendarMock />}
        </div>
      </div>
    </div>
  );
}
