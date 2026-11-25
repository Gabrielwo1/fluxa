import { ensureCompany } from "@/lib/erp/auth";
import { one, q } from "@/lib/erp/db";
import { atendente, mercadolivre } from "@/lib/erp/connectors/atendente";
import { loja } from "@/lib/erp/connectors/loja";
import { syncConfig } from "@/lib/erp/connectors/config";
import type { Connector, ConnectorCtx } from "@/lib/erp/connectors/types";
import { ingest, SOURCE_LABEL, type Source } from "@/lib/erp/services/ingest";
import { mvpClientName } from "@/lib/mvp";

// Sincronização automática: de tempos em tempos o Fluxa busca nas origens (atendente, Mercado Livre pelo
// atendente, loja) o que mudou e passa pelo mesmo caminho do POST /api/ingest. Cada origem guarda "até que
// dia já foi buscado" (erp_sync_state); a cada rodada relê só os últimos dias, o suficiente para pegar
// pagamentos, cancelamentos e notas fiscais que chegam depois do pedido.

const todayBr = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
// primeira rodada de uma origem: quantos dias de histórico trazer (o resto vem com `npm run sync -- --from`)
const BACKFILL_DAYS = () => Number(process.env.SYNC_BACKFILL_DAYS) || 60;

export function connectorsFor(tenant: string): Connector[] {
  const cfg = syncConfig(tenant);
  return [
    ...(cfg.atendente ? [atendente(cfg.atendente), mercadolivre(cfg.atendente)] : []),
    ...(cfg.loja ? [loja(cfg.loja)] : []),
  ];
}

export type SyncReport = {
  source: Source;
  ok: boolean;
  partial: boolean;
  from: string;
  created: number;
  updated: number;
  failed: number;
  error: string | null;
};

const ctxFor = (tenant: string, warnings: string[]): ConnectorCtx => ({
  tenant,
  warn: (m) => {
    if (!warnings.includes(m)) warnings.push(m);
  },
  async known(kind, source, ids) {
    if (ids.length === 0) return new Set();
    const rows =
      kind === "sale"
        ? await q<{ external_id: string }>(
            tenant,
            "select external_id from erp_external_refs where tenant = $1 and source = $2 and kind = 'sale' and external_id = any($3::text[])",
            [source, ids]
          )
        : await q<{ external_id: string }>(
            tenant,
            `select r.external_id from erp_external_refs r
              where r.tenant = $1 and r.source = $2 and r.kind = 'sale' and r.external_id = any($3::text[])
                and exists (select 1 from erp_invoices i where i.tenant = r.tenant and i.sale_id = r.local_id)`,
            [source, ids]
          );
    return new Set(rows.map((r) => r.external_id));
  },
});

async function runConnector(tenant: string, c: Connector, opts: { from?: string; deadline: number }): Promise<SyncReport> {
  const to = todayBr();
  const state = await one<{ synced_until: string | null }>(
    tenant,
    "select synced_until::text as synced_until from erp_sync_state where tenant = $1 and source = $2",
    [c.source]
  );
  const from = opts.from ?? (state?.synced_until ? addDays(state.synced_until, -c.overlapDays) : addDays(to, -BACKFILL_DAYS()));
  const report: SyncReport = { source: c.source, ok: true, partial: false, from, created: 0, updated: 0, failed: 0, error: null };
  const warnings: string[] = [];
  let until: string | null = null;
  let error: string | null = null;

  try {
    for await (const chunk of c.run(ctxFor(tenant, warnings), from, to)) {
      const r = await ingest(tenant, { source: c.source, ...chunk.payload });
      report.created += r.customers.created + r.orders.created + r.invoices.created;
      report.updated += r.customers.updated + r.orders.updated + r.invoices.updated + r.stats;
      report.failed += r.failed;
      // item que falha (ex.: estoque insuficiente) fica no histórico de envios e é tentado de novo na janela recente
      if (chunk.until) until = chunk.until;
      if (Date.now() > opts.deadline) {
        report.partial = true;
        break;
      }
    }
  } catch (e) {
    error = (e as Error).message.slice(0, 500);
    report.ok = false;
    report.error = error;
  }

  const note = [error, ...warnings.map((w) => `Aviso: ${w}`)].filter(Boolean).join(" · ") || null;
  await q(
    tenant,
    `insert into erp_sync_state (tenant, source, synced_until, last_run_at, last_ok_at, last_error)
     values ($1, $2, $3, now(), case when $4 then now() end, $5)
     on conflict (tenant, source) do update set
       synced_until = coalesce(excluded.synced_until, erp_sync_state.synced_until),
       last_run_at = now(),
       last_ok_at = case when $4 then now() else erp_sync_state.last_ok_at end,
       last_error = $5`,
    [c.source, until, report.ok, note]
  );
  return report;
}

// Uma rodada para uma empresa. "budgetMs" limita o tempo (a função do agendador tem teto de 60 s):
// o que sobrar continua na próxima rodada, de onde parou.
export async function syncTenant(tenant: string, opts: { from?: string; budgetMs?: number; sources?: Source[] } = {}): Promise<SyncReport[]> {
  await ensureCompany(tenant, mvpClientName(tenant));
  const deadline = Date.now() + (opts.budgetMs ?? 45_000);
  const reports: SyncReport[] = [];
  for (const c of connectorsFor(tenant)) {
    if (opts.sources && !opts.sources.includes(c.source)) continue;
    if (Date.now() > deadline) {
      reports.push({ source: c.source, ok: true, partial: true, from: "", created: 0, updated: 0, failed: 0, error: null });
      continue;
    }
    reports.push(await runConnector(tenant, c, { from: opts.from, deadline }));
  }
  return reports;
}

export type SyncStatus = { source: Source; label: string; configured: boolean; synced_until: string | null; last_run_at: string | null; last_ok_at: string | null; last_error: string | null };

export async function syncStatus(tenant: string): Promise<SyncStatus[]> {
  const configured = new Set(connectorsFor(tenant).map((c) => c.source));
  const rows = await q<Omit<SyncStatus, "source" | "label" | "configured"> & { source: Source }>(
    tenant,
    "select source, synced_until::text as synced_until, last_run_at, last_ok_at, last_error from erp_sync_state where tenant = $1",
    []
  );
  return (["atendente", "mercadolivre", "loja"] as Source[]).map((source) => {
    const r = rows.find((x) => x.source === source);
    return { source, label: SOURCE_LABEL[source], configured: configured.has(source), synced_until: r?.synced_until ?? null, last_run_at: r?.last_run_at ?? null, last_ok_at: r?.last_ok_at ?? null, last_error: r?.last_error ?? null };
  });
}
