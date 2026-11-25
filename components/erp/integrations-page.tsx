"use client";

import { AlertTriangle, CheckCircle2, Globe, Loader2, MessageCircle, RefreshCw, ShoppingBag, Store } from "lucide-react";
import { useState } from "react";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { call, useApi } from "@/lib/erp/client";
import { fmtDate, money } from "@/lib/erp/format";
import type { SourceOverview } from "@/lib/erp/services/ingest";
import type { SyncStatus } from "@/lib/erp/services/sync";
import { ErrorNote, Kpi, LoadingRows, PageHeader, Tag } from "@/components/erp/ui";
import { ErpGate } from "@/components/erp/gate";

type Data = { endpoint: string; key_configured: boolean; overview: SourceOverview[]; sync: SyncStatus[] };

const ICON = { atendente: MessageCircle, loja: Store, mercadolivre: ShoppingBag } as const;
const WHAT: Record<SourceOverview["source"], string> = {
  atendente: "Clientes que chamam no WhatsApp viram cadastro (lead) e as vendas fechadas entram como pedidos.",
  loja: "Pedidos da loja, clientes e os números do painel (visitas, carrinho, checkout).",
  mercadolivre: "Pedidos, compradores e notas fiscais (NF-e) da conta do Mercado Livre.",
};

const when = (iso: string) => `${fmtDate(iso)} ${new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

export function IntegrationsPage() {
  return <ErpGate>{() => <Inner />}</ErpGate>;
}

function Inner() {
  const { data, error, loading, reload } = useApi<Data>("/api/erp/integrations");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const anyConfigured = data?.sync.some((s) => s.configured) ?? false;

  async function syncNow() {
    setSyncing(true);
    setSyncError(null);
    try {
      await call("POST", "/api/erp/integrations/sync");
      reload();
    } catch (e) {
      setSyncError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Integrações"
        description="De onde vêm os dados: atendente do WhatsApp, loja virtual e Mercado Livre."
        actions={anyConfigured && (
          <Button className="rounded-full font-semibold" onClick={syncNow} disabled={syncing}>
            {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Sincronizar agora
          </Button>
        )}
        help={
          <>
            <p>O Fluxa <strong>busca sozinho</strong>, a cada poucas horas, o que mudou no atendente (que já traz o Mercado Livre) e na loja. Também aceita dados enviados por quem tiver a chave da empresa. O que já chegou nunca é duplicado.</p>
            <p>Cliente novo vira cadastro, pedido vira venda (paga entra no caixa do canal; aguardando pagamento vira conta a receber) e a nota fiscal fica ligada ao pedido.</p>
          </>
        }
      />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {syncError && <ErrorNote message={syncError} />}
      {loading && !data ? (
        <LoadingRows />
      ) : data ? (
        <>
          {!data.key_configured && (
            <Panel className="mb-4 border-[var(--c-fixed)]/40">
              <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} /> Chave de integração ainda não criada</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Defina a variável <code className="rounded bg-muted px-1">INGEST_KEY_{"<EMPRESA>"}</code> (mínimo 24 caracteres, gere com <code className="rounded bg-muted px-1">openssl rand -hex 32</code>) no ambiente do Fluxa e publique de novo. Quem envia usa essa chave no cabeçalho <code className="rounded bg-muted px-1">Authorization: Bearer</code>.
              </p>
            </Panel>
          )}
          <Panel className="mb-4">
            <p className="flex items-center gap-2 text-sm font-semibold"><Globe size={16} /> Endereço de envio</p>
            <p className="mt-1 break-all rounded-xl bg-muted px-3 py-2 font-mono text-xs">POST {data.endpoint}</p>
            <p className="mt-2 text-xs text-muted-foreground">Corpo JSON com <code>source</code> (atendente, loja ou mercadolivre) e as listas <code>customers</code>, <code>orders</code>, <code>invoices</code> e <code>stats</code>. Detalhes em docs/INTEGRACOES.md.</p>
          </Panel>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {data.overview.map((o) => <SourceCard key={o.source} o={o} sync={data.sync.find((x) => x.source === o.source)} />)}
          </div>
        </>
      ) : null}
    </>
  );
}

function SourceCard({ o, sync }: { o: SourceOverview; sync?: SyncStatus }) {
  const Icon = ICON[o.source];
  const f = o.last_30d;
  const failing = o.recent[0]?.failed ?? 0;
  const lastErrors = o.recent.find((r) => r.failed > 0)?.errors.slice(0, 3) ?? [];
  return (
    <Panel>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted"><Icon size={18} /></span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{o.label}</h2>
            <p className="text-xs text-muted-foreground">{o.last_sync ? `Último envio: ${when(o.last_sync)}` : "Nada recebido ainda"}</p>
          </div>
        </div>
        {!o.last_sync ? <Tag>Aguardando</Tag> : failing > 0 ? <Tag tone="warn">Com erros</Tag> : <Tag tone="good">Recebendo</Tag>}
      </div>
      <p className="mb-3 text-sm text-muted-foreground">{WHAT[o.source]}</p>
      {sync && <SyncLine sync={sync} />}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Kpi label="Vendas (30 dias)" value={money(f.revenue)} sub={`${f.sales} pedido(s)`} />
        <Kpi label="Receita total" value={money(o.revenue)} sub={`${o.sales} pedido(s)`} />
        <Kpi label="Clientes" value={String(o.parties)} />
        <Kpi label="Notas fiscais" value={String(o.invoices)} />
      </div>
      {f.sessions > 0 && <Funnel f={f} />}
      {lastErrors.length > 0 && (
        <div className="mt-3 rounded-xl bg-bad/10 p-3 text-xs">
          <p className="mb-1 font-semibold text-bad">Itens que não entraram no último envio</p>
          <ul className="space-y-0.5">
            {lastErrors.map((e, i) => <li key={i}><span className="font-mono">{e.external_id}</span>: {e.message}</li>)}
          </ul>
        </div>
      )}
      {o.recent.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-muted-foreground">Últimos envios</summary>
          <ul className="mt-2 space-y-1">
            {o.recent.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span>{when(r.at)}</span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  {r.failed === 0 && <CheckCircle2 size={12} className="text-good" />}
                  {r.created} novos · {r.updated} atualizados{r.failed ? ` · ${r.failed} com erro` : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  );
}

function SyncLine({ sync }: { sync: SyncStatus }) {
  if (!sync.configured) return <p className="mb-3 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">Busca automática não configurada (veja docs/INTEGRACOES.md).</p>;
  const [error, ...warnings] = (sync.last_error ?? "").split(" · Aviso: ");
  const isWarningOnly = error.startsWith("Aviso: ");
  return (
    <div className="mb-3 rounded-xl bg-muted px-3 py-2 text-xs">
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <RefreshCw size={12} />
        {sync.last_ok_at ? `Buscado em ${when(sync.last_ok_at)} (até ${fmtDate(sync.synced_until)})` : "Ainda não buscou"} · a cada poucas horas
      </p>
      {sync.last_error && !isWarningOnly && <p className="mt-1 font-medium text-bad">Última tentativa falhou: {error}</p>}
      {[...(isWarningOnly ? [error.replace(/^Aviso: /, "")] : []), ...warnings].map((w, i) => <p key={i} className="mt-1 text-[var(--c-fixed)]">Aviso: {w}</p>)}
    </div>
  );
}

// Funil da loja: quantos chegam em cada etapa, sobre as sessões.
function Funnel({ f }: { f: SourceOverview["last_30d"] }) {
  const steps = [
    { label: "Sessões", n: f.sessions },
    { label: "Viram um produto", n: f.product_views },
    { label: "Foram ao carrinho", n: f.add_to_cart },
    { label: "Iniciaram o checkout", n: f.checkouts },
    { label: "Compraram", n: f.orders },
  ];
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-muted-foreground">Funil dos últimos 30 dias · {f.visitors} visitantes</p>
      <ul className="space-y-1.5">
        {steps.map((s) => (
          <li key={s.label} className="text-xs">
            <div className="mb-0.5 flex justify-between"><span>{s.label}</span><span className="tabular-nums text-muted-foreground">{s.n} · {Math.round((s.n / f.sessions) * 100)}%</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[var(--c-total)]" style={{ width: `${Math.min(100, (s.n / f.sessions) * 100)}%` }} /></div>
          </li>
        ))}
      </ul>
    </div>
  );
}
