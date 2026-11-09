"use client";

import { useState } from "react";
import { toast } from "sonner";
import { call, useApi } from "@/lib/erp/client";
import type { Account, Title } from "@/lib/erp/types";
import { fmtDate, money, todayIso } from "@/lib/erp/format";
import { DateField, Field, FormDialog, MoneyInput, SelectField } from "@/components/erp/ui";

// Dar baixa: marca o lançamento como recebido ou pago, na data e na conta escolhidas.
export function PayDialog({ title, onOpenChange, onDone }: { title: Title | null; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  return title ? <Inner key={title.id} title={title} onOpenChange={onOpenChange} onDone={onDone} /> : null;
}

function Inner({ title, onOpenChange, onDone }: { title: Title; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const incoming = title.direction === "in";
  const accounts = useApi<{ accounts: Account[] }>("/api/erp/accounts");
  const active = (accounts.data?.accounts ?? []).filter((a) => a.active);
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState(title.amount);
  const [accountId, setAccountId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = accountId || active.find((a) => a.kind === "cash")?.id || active[0]?.id || "";

  async function save() {
    setError(null);
    if (!chosen) return setError("Cadastre um caixa ou conta em Caixas e contas.");
    setBusy(true);
    try {
      await call("POST", `/api/erp/titles/${title.id}/pay`, { paid_at: date, paid_amount: amount, account_id: chosen });
      toast.success(incoming ? "Recebimento registrado." : "Pagamento registrado.");
      onDone();
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title={incoming ? "Registrar recebimento" : "Registrar pagamento"}
      description={`${title.description} · vence ${fmtDate(title.due_date)} · ${money(title.amount)}`}
      submitLabel={incoming ? "Confirmar recebimento" : "Confirmar pagamento"}
      onSubmit={save}
      busy={busy}
      error={error}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={incoming ? "Data do recebimento" : "Data do pagamento"}>
          <DateField value={date} onChange={setDate} />
        </Field>
        <Field label={incoming ? "Valor recebido" : "Valor pago"} hint={amount !== title.amount ? "Diferente do valor original (juros ou desconto)." : undefined}>
          <MoneyInput value={amount} onChange={setAmount} />
        </Field>
      </div>
      <Field label={incoming ? "Entrou em" : "Saiu de"}>
        <SelectField value={chosen} onChange={setAccountId} options={active.map((a) => ({ value: a.id, label: a.name }))} />
      </Field>
    </FormDialog>
  );
}
