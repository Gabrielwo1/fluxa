"use client";

import { addDays, splitAmount } from "@/lib/erp/dates";
import { fmtDate, money } from "@/lib/erp/format";
import { PAYMENT_METHODS, type Account } from "@/lib/erp/types";
import { DateField, Field, NumberField, SelectField } from "@/components/erp/ui";
import { cn } from "@/lib/utils";

export type PaymentState = {
  mode: "now" | "later";
  method: string;
  installments: number;
  firstDue: string;
  interval: number;
  accountId: string;
};

export const defaultPayment = (issue: string): PaymentState => ({
  mode: "now",
  method: "Pix",
  installments: 1,
  firstDue: addDays(issue, 30),
  interval: 30,
  accountId: "",
});

export const toConfirmPayload = (p: PaymentState, issue: string) => ({
  method: p.method,
  installments: p.mode === "now" ? 1 : p.installments,
  first_due: p.mode === "now" ? issue : p.firstDue,
  interval_days: p.interval,
  paid_now: p.mode === "now",
  account_id: p.mode === "now" && p.accountId ? p.accountId : null,
});

// Como vai ser pago: na hora ou parcelado, com a agenda de vencimentos calculada na tela.
export function PaymentFields({
  value,
  onChange,
  total,
  direction,
  accounts,
  issueDate,
}: {
  value: PaymentState;
  onChange: (p: PaymentState) => void;
  total: number;
  direction: "in" | "out";
  accounts: Account[];
  issueDate: string;
}) {
  const incoming = direction === "in";
  const set = (patch: Partial<PaymentState>) => onChange({ ...value, ...patch });
  const parts = splitAmount(Math.max(total, 0), value.mode === "now" ? 1 : Math.max(1, value.installments));

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Quando será pago" className="grid grid-cols-2 gap-2">
        {(
          [
            ["now", incoming ? "Recebi agora" : "Paguei agora", incoming ? "Dinheiro, Pix, cartão na hora" : "Já saiu do caixa ou da conta"],
            ["later", "A prazo", incoming ? "Parcelado ou para receber depois" : "Boleto ou parcelas a pagar"],
          ] as const
        ).map(([m, label, hint]) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={value.mode === m}
            onClick={() => set({ mode: m })}
            className={cn("rounded-xl border p-3 text-left transition-colors", value.mode === m ? "border-primary bg-primary/15" : "hover:bg-muted")}
          >
            <span className="block text-sm font-semibold">{label}</span>
            <span className="block text-xs text-muted-foreground">{hint}</span>
          </button>
        ))}
      </div>

      <Field label="Forma de pagamento">
        <SelectField value={value.method} onChange={(v) => set({ method: v })} options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} />
      </Field>

      {value.mode === "now" ? (
        <Field label={incoming ? "Entrou em" : "Saiu de"}>
          <SelectField
            value={value.accountId || accounts.find((a) => a.kind === "cash")?.id || accounts[0]?.id || ""}
            onChange={(v) => set({ accountId: v })}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          />
        </Field>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Parcelas">
              <NumberField value={value.installments} onChange={(n) => set({ installments: Math.min(48, Math.max(1, Math.round(n) || 1)) })} />
            </Field>
            <Field label="1º vencimento" className="col-span-2">
              <DateField value={value.firstDue} onChange={(v) => set({ firstDue: v })} />
            </Field>
          </div>
          {value.installments > 1 && (
            <Field label="Intervalo entre parcelas" hint="Em dias. 30 = todo mês.">
              <NumberField value={value.interval} onChange={(n) => set({ interval: Math.max(1, Math.round(n) || 30) })} suffix="dias" />
            </Field>
          )}
          {total > 0 && (
            <ul className="divide-y rounded-xl border text-sm">
              {parts.map((v, i) => (
                <li key={i} className="flex items-center justify-between px-3 py-2">
                  <span className="text-muted-foreground">
                    {parts.length > 1 ? `${i + 1}/${parts.length} · ` : ""}
                    vence {fmtDate(addDays(value.firstDue || issueDate, value.interval * i))}
                  </span>
                  <span className="font-semibold tabular-nums">{money(v)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
