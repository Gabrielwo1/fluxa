"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useFinance, type Bill, type BillKind } from "@/components/finance-provider";
import { Segmented, Stat } from "@/components/invest/fields";
import { PageTitle, Panel, PanelHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl, brlCompact, monthLabel, shiftMonth } from "@/lib/format";

const KINDS: { value: BillKind; label: string }[] = [
  { value: "out", label: "Saída (conta a pagar)" },
  { value: "in", label: "Entrada (cliente)" },
];

function BillRow({ bill, onRemove }: { bill: Bill; onRemove: () => void }) {
  return (
    <div className="group flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{bill.name}</p>
        <p className="text-xs text-muted-foreground">todo dia {bill.day}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span
          className={`text-sm font-semibold tabular-nums ${bill.kind === "in" ? "text-good" : ""}`}
        >
          {bill.kind === "in" ? "+ " : ""}
          {brl.format(bill.amount)}
        </span>
        <button
          onClick={onRemove}
          className="text-muted-foreground/60 transition hover:text-destructive"
          aria-label={`Remover ${bill.name}`}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

// dias de 1 a 31; em meses curtos, o dia 31 vale o último dia do mês
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

function dueText(day: number, today: number, lastDay: number): { text: string; late: boolean } {
  const due = Math.min(day, lastDay);
  if (due === today) return { text: "vence hoje", late: false };
  if (due > today) return { text: `em ${due - today} ${due - today === 1 ? "dia" : "dias"}`, late: false };
  return { text: `dia ${due} já passou`, late: true };
}

export default function FixedBillsPage() {
  const { ready, bills, fixedTotal, addBill, removeBill, aggOf, currentKey } =
    useFinance();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("");
  const [kind, setKind] = useState<BillKind>("out");
  const [now] = useState(() => new Date());

  if (!ready) return null;

  const outs = bills.filter((b) => b.kind !== "in");
  const ins = bills.filter((b) => b.kind === "in");
  const inTotal = ins.reduce((s, b) => s + b.amount, 0);
  const lastDay = daysIn(now.getFullYear(), now.getMonth());
  const month = [...bills].sort(
    (a, b) => Math.min(a.day, lastDay) - Math.min(b.day, lastDay)
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(amount.replace(",", "."));
    if (!name.trim() || !value) return;
    await addBill(name.trim(), value, parseInt(day) || 1, kind);
    setName("");
    setAmount("");
    setDay("");
  }

  const future = Array.from({ length: 6 }, (_, i) =>
    aggOf(shiftMonth(currentKey, i + 1))
  );
  const maxFuture = Math.max(1, ...future.map((m) => m.expense));

  return (
    <>
      <PageTitle
        title="Contas fixas"
        subtitle="Entram na previsão a partir do próximo mês; no mês atual e nos anteriores já estão nos lançamentos reais."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Cadastradas"
            right={
              <span className="text-sm font-semibold tabular-nums">
                {brl.format(fixedTotal)}/mês
              </span>
            }
          />
          <div className="mb-5 space-y-5">
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold">Saídas fixas</p>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {brl.format(fixedTotal)}/mês
                </span>
              </div>
              <div className="divide-y">
                {outs.map((b) => (
                  <BillRow key={b.id} bill={b} onRemove={() => removeBill(b.id)} />
                ))}
                {outs.length === 0 && (
                  <p className="py-3 text-sm text-muted-foreground">Nenhuma conta fixa cadastrada.</p>
                )}
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold">Entradas de clientes</p>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {brl.format(inTotal)}/mês
                </span>
              </div>
              <div className="divide-y">
                {ins.map((b) => (
                  <BillRow key={b.id} bill={b} onRemove={() => removeBill(b.id)} />
                ))}
                {ins.length === 0 && (
                  <p className="py-3 text-sm text-muted-foreground">
                    Nenhuma cobrança cadastrada. Use &ldquo;Entrada&rdquo; abaixo para um cliente que paga todo mês.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mb-3 max-w-md">
            <Segmented label="Tipo do lançamento" value={kind} options={KINDS} onChange={setKind} />
          </div>
          <form onSubmit={submit} className="flex flex-wrap gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === "in" ? "Cliente (ex.: Maria Silva)" : "Nome (ex.: aluguel)"}
              className="min-w-0 flex-1 basis-40"
              aria-label={kind === "in" ? "Nome do cliente" : "Nome da conta fixa"}
            />
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Valor"
              inputMode="decimal"
              className="w-28"
              aria-label="Valor"
            />
            <Input
              value={day}
              onChange={(e) => setDay(e.target.value)}
              placeholder="Dia"
              inputMode="numeric"
              className="w-20"
              aria-label={kind === "in" ? "Dia da cobrança" : "Dia do mês"}
            />
            <Button type="submit" className="rounded-full font-semibold">
              <Plus size={15} /> Adicionar
            </Button>
          </form>
        </Panel>

        <div className="min-w-0 space-y-4">
        <Panel>
          <PanelHeader
            title="Controle do mês"
            subtitle="cobranças e contas que se repetem, por dia. Só para acompanhar: não vem do banco"
          />
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="A receber" value={`+ ${brl.format(inTotal)}`} tone="good" />
            <Stat label="A pagar" value={brl.format(fixedTotal)} />
            <Stat
              label="Saldo do mês"
              value={`${inTotal - fixedTotal < 0 ? "− " : ""}${brl.format(Math.abs(inTotal - fixedTotal))}`}
              tone={inTotal - fixedTotal >= 0 ? "good" : "bad"}
            />
          </div>
          {month.length === 0 ? (
            <p className="text-sm text-muted-foreground">Cadastre entradas e saídas para ver o calendário do mês.</p>
          ) : (
            <div className="divide-y">
              {month.map((b) => {
                const due = dueText(b.day, now.getDate(), lastDay);
                return (
                  <div key={b.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                      {Math.min(b.day, lastDay)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{b.name}</p>
                      <p className={`text-xs ${due.late ? "text-muted-foreground" : "text-foreground/70"}`}>
                        {b.kind === "in" ? "receber" : "pagar"} · {due.text}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-sm font-semibold tabular-nums ${b.kind === "in" ? "text-good" : ""}`}
                    >
                      {b.kind === "in" ? "+ " : "− "}
                      {brl.format(b.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Previsão dos próximos meses"
            subtitle="contas fixas + parcelas do cartão já lançadas"
          />
          <div className="space-y-4">
            {future.map((m) => (
              <div key={m.key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{monthLabel(m.key)}</span>
                  <span className="font-semibold tabular-nums">
                    {brl.format(m.expense)}
                  </span>
                </div>
                <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-l-full"
                    title={`Contas fixas: ${brl.format(m.fixed)}`}
                    style={{
                      width: `${(m.fixed / maxFuture) * 100}%`,
                      background: "var(--c-fixed)",
                    }}
                  />
                  {m.card > 0 && (
                    <div
                      className="h-full rounded-r-full"
                      title={`Parcelas: ${brl.format(m.card)}`}
                      style={{
                        width: `${(m.card / maxFuture) * 100}%`,
                        background: "var(--c-card)",
                      }}
                    />
                  )}
                </div>
                <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                  fixas {brlCompact.format(m.fixed)} · parcelas{" "}
                  {brlCompact.format(m.card)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--c-fixed)" }} />
              Contas fixas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--c-card)" }} />
              Parcelas do cartão
            </span>
          </div>
        </Panel>
        </div>
      </div>
    </>
  );
}
