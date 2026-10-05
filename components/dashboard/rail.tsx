"use client";

import Link from "next/link";
import {
  ArrowLeftRight,
  CreditCard,
  Plus,
  Receipt,
  RefreshCw,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Panel, PanelHeader, PageLink } from "@/components/ui-kit";
import { TxRow } from "@/components/tx-row";
import { useFinance, type Account } from "@/components/finance-provider";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AccountCardVisual({ account }: { account: Account }) {
  const isBank = account.type === "BANK";
  return (
    <div
      className={cn(
        "relative flex aspect-[1.7/1] min-w-[85%] snap-start flex-col justify-between overflow-hidden rounded-2xl p-4 sm:min-w-[78%]",
        isBank
          ? "bg-gradient-to-br from-[#a3e635] via-[#84cc16] to-[#65a30d] text-[#1a2e05]"
          : "bg-gradient-to-br from-[#2a2f25] to-[#11140e] text-[#f3f6ee]"
      )}
    >
      <div
        aria-hidden
        className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/15"
      />
      <div className="relative flex items-center justify-between">
        <span className="text-xs font-semibold opacity-80">
          {isBank ? "Conta" : "Cartão de crédito"}
        </span>
        {isBank ? <Wallet size={18} /> : <CreditCard size={18} />}
      </div>
      <div className="relative">
        <p className="truncate text-xs font-medium opacity-80">
          {account.marketingName || account.name}
        </p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight">
          {brl.format(account.balance)}
        </p>
        <p className="text-[11px] opacity-70">
          {isBank ? "saldo disponível" : "valor da fatura"}
        </p>
      </div>
    </div>
  );
}

export function AccountsRail() {
  const { accounts, startConnect, connecting } = useFinance();
  return (
    <Panel>
      <PanelHeader
        title="Minhas contas"
        subtitle={`${accounts.length} ${accounts.length === 1 ? "conta" : "contas"} conectadas`}
        right={
          <button
            onClick={startConnect}
            disabled={connecting}
            className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            <Plus size={13} /> Conectar
          </button>
        }
      />
      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
        {accounts.map((a) => (
          <AccountCardVisual key={a.id} account={a} />
        ))}
      </div>
    </Panel>
  );
}

function Action({
  Icon,
  label,
  onClick,
  href,
  disabled,
}: {
  Icon: LucideIcon;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const cls =
    "flex flex-1 flex-col items-center gap-1.5 rounded-2xl border bg-background/50 px-2 py-3 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50";
  const inner = (
    <>
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/25">
        <Icon size={16} />
      </span>
      {label}
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button onClick={onClick} disabled={disabled} className={cls}>
      {inner}
    </button>
  );
}

export function QuickActions() {
  const { refresh, loading, startConnect, connecting } = useFinance();
  return (
    <Panel>
      <PanelHeader title="Ações rápidas" />
      <div className="flex gap-2">
        <Action Icon={RefreshCw} label="Atualizar" onClick={refresh} disabled={loading} />
        <Action Icon={Plus} label="Conectar" onClick={startConnect} disabled={connecting} />
        <Action Icon={Receipt} label="Fixas" href="/contas-fixas" />
        <Action Icon={ArrowLeftRight} label="Extrato" href="/transacoes" />
      </div>
    </Panel>
  );
}

export function RecentTransactions() {
  const { txs } = useFinance();
  const today = new Date().toISOString().slice(0, 10);
  // mais recentes já ocorridas (lançamentos datados à frente são parcelas futuras)
  const recent = txs.filter((t) => t.date.slice(0, 10) <= today).slice(0, 7);
  return (
    <Panel>
      <PanelHeader
        title="Transações recentes"
        right={<PageLink href="/transacoes">Ver todas</PageLink>}
      />
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem transações ainda.</p>
      ) : (
        <div className="divide-y">
          {recent.map((t) => (
            <TxRow key={t.id} tx={t} compact showAccount={false} />
          ))}
        </div>
      )}
    </Panel>
  );
}
