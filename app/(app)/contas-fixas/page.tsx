"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useFinance } from "@/components/finance-provider";
import { PageTitle, Panel, PanelHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl, brlCompact, monthLabel, shiftMonth } from "@/lib/format";

export default function FixedBillsPage() {
  const { ready, bills, fixedTotal, addBill, removeBill, aggOf, currentKey } =
    useFinance();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("");

  if (!ready) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(amount.replace(",", "."));
    if (!name.trim() || !value) return;
    await addBill(name.trim(), value, parseInt(day) || 1);
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
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Cadastradas"
            right={
              <span className="text-sm font-semibold tabular-nums">
                {brl.format(fixedTotal)}/mês
              </span>
            }
          />
          <div className="mb-5 divide-y">
            {bills.map((b) => (
              <div key={b.id} className="group flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{b.name}</p>
                  <p className="text-xs text-muted-foreground">todo dia {b.day}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums">
                    {brl.format(b.amount)}
                  </span>
                  <button
                    onClick={() => removeBill(b.id)}
                    className="text-muted-foreground/60 transition hover:text-destructive"
                    aria-label={`Remover ${b.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
            {bills.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">
                Nenhuma conta fixa cadastrada.
              </p>
            )}
          </div>

          <form onSubmit={submit} className="flex flex-wrap gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome (ex.: aluguel)"
              className="min-w-0 flex-1 basis-40"
              aria-label="Nome da conta fixa"
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
              aria-label="Dia do mês"
            />
            <Button type="submit" className="rounded-full font-semibold">
              <Plus size={15} /> Adicionar
            </Button>
          </form>
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
    </>
  );
}
