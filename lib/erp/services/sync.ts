import { ensureCompany } from "@/lib/erp/auth";
import { one, q } from "@/lib/erp/db";
import { atendente, mercadolivre } from "@/lib/erp/connectors/atendente";
import { loja } from "@/lib/erp/connectors/loja";
import { syncConfig } from "@/lib/erp/connectors/config";
import { addDays as addDaysIso, type Connector, type ConnectorCtx } from "@/lib/erp/connectors/types";
import { ingest, SOURCE_LABEL, type Source } from "@/lib/erp/services/ingest";
import { mvpClientName } from "@/lib/mvp";

// Sincronização automática: de tempos em tempos o Fluxa busca nas origens (atendente, Mercado Livre pelo
// atendente, loja) o que mudou e passa pelo mesmo caminho do POST /api/ingest. Cada origem guarda "até que
// dia já foi buscado" (erp_sync_state); a cada rodada relê só os últimos dias, o suficiente para pegar
// pagamentos, cancelamentos e notas fiscais que chegam depois do pedido.

const todayBr = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const addDays = addDaysIso;
// primeira rodada de uma origem: quantos dias de histórico trazer (o resto vem com `npm run sync -- --from`)
const BACKFILL_DAYS = () => Number(process.env.SYNC_BACKFILL_DAYS) || 60;

// A loja e o atendente são rápidos; o Mercado Livre (3 consultas por pedido novo) fica por último e usa o tempo que sobrar.
export function connectorsFor(tenant: string): Connector[] {
  const cfg = syncConfig(tenant);
  return [
    ...(cfg.atendente ? [atendente(cfg.atendente)] : []),
    ...(cfg.loja ? [loja(cfg.loja)] : []),
    ...(cfg.atendente ? [mercadolivre(cfg.atendente)] : []),
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

type Interval = { from: string; to: string };

// Junta as janelas prontas ao intervalo que já existia e fica com o bloco contínuo mais recente.
function mergeIntervals(list: Interval[]): Interval | null {
  if (list.length === 0) return null;
  const sorted = [...list].sort((p, q) => p.from.localeCompare(q.from));
  const blocks: Interval[] = [{ ...sorted[0] }];
  for (const w of sorted.slice(1)) {
    const last = blocks[blocks.length - 1];
    if (w.from <= addDays(last.to, 1)) last.to = w.to > last.to ? w.to : last.to;
    else blocks.push({ ...w });
  }
  return blocks[blocks.length - 1];
}

// Uma origem numa rodada: primeiro os dias recentes (de onde parou até hoje), depois o histórico para trás,
// sempre do mais novo para o mais antigo. O intervalo já buscado [synced_from, synced_until] é gravado a
// cada janela pronta; se o tempo acabar, a próxima rodada continua dali.
async function runConnector(tenant: string, c: Connector, opts: { from?: string; deadline: number }): Promise<SyncReport> {
  const today = todayBr();
  const state = await one<{ synced_from: string | null; synced_until: string | null }>(
    tenant,
    "select synced_from::text as synced_from, synced_until::text as synced_until from erp_sync_state where tenant = $1 and source = $2",
    [c.source]
  );
  const saved: Interval | null = state?.synced_until ? { from: state.synced_from ?? state.synced_until, to: state.synced_until } : null;
  const target = opts.from ?? addDays(today, -BACKFILL_DAYS());
  // primeira vez: só uma semana para o que é recente aparecer logo; o histórico vem na sequência
  const recentFrom = saved ? addDays(saved.to, -c.overlapDays) : addDays(today, -6);
  const report: SyncReport = { source: c.source, ok: true, partial: false, from: recentFrom, created: 0, updated: 0, failed: 0, error: null };
  const warnings: string[] = [];
  const done: Interval[] = saved ? [saved] : [];
  let error: string | null = null;
  const ctx = ctxFor(tenant, warnings);

  const persist = async () => {
    const cov = mergeIntervals(done);
    if (!cov) return;
    await q(
      tenant,
      `insert into erp_sync_state (tenant, source, synced_from, synced_until, last_run_at) values ($1, $2, $3, $4, now())
       on conflict (tenant, source) do update set synced_from = excluded.synced_from, synced_until = excluded.synced_until, last_run_at = now()`,
      [c.source, cov.from, cov.to]
    );
  };

  async function pass(from: string, to: string): Promise<boolean> {
    for await (const chunk of c.run(ctx, from, to)) {
      const r = await ingest(tenant, { source: c.source, ...chunk.payload });
      report.created += r.customers.created + r.orders.created + r.invoices.created;
      report.updated += r.customers.updated + r.orders.updated + r.invoices.updated + r.stats;
      report.failed += r.failed;
      // item que falha (ex.: estoque insuficiente) fica no histórico de envios e é tentado de novo na janela recente
      if (chunk.window) {
        done.push(chunk.window);
        await persist();
      }
      if (Date.now() > opts.deadline) return false;
    }
    return true;
  }

  try {
    let finished = await pass(recentFrom, today);
    const cov = mergeIntervals(done);
    // histórico: tudo que está antes do que já foi buscado, até a data pedida
    if (finished && cov && cov.from > target) finished = await pass(target, addDays(cov.from, -1));
    report.partial = !finished;
  } catch (e) {
    error = (e as Error).message.slice(0, 500);
    report.ok = false;
    report.error = error;
  }

  const note = [error, ...warnings.map((w) => `Aviso: ${w}`)].filter(Boolean).join(" · ") || null;
  await q(
    tenant,
    `insert into erp_sync_state (tenant, source, last_run_at, last_ok_at, last_error) values ($1, $2, now(), case when $3 then now() end, $4)
     on conflict (tenant, source) do update set
       last_run_at = now(),
       last_ok_at = case when $3 then now() else erp_sync_state.last_ok_at end,
       last_error = $4`,
    [c.source, report.ok, note]
  );
  return report;
}

// Uma rodada para uma empresa. "budgetMs" limita o tempo (a função do agendador tem teto de 60 s):
// o que sobrar continua na próxima rodada, de onde parou.
export async function syncTenant(tenant: string, opts: { from?: string; budgetMs?: number; sources?: Source[] } = {}): Promise<SyncReport[]> {
  await ensureCompany(tenant, mvpClientName(tenant));
  const deadline = Date.now() + (opts.budgetMs ?? 240_000);
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

export type SyncStatus = { source: Source; label: string; configured: boolean; synced_from: string | null; backfill_start: string; synced_until: string | null; last_run_at: string | null; last_ok_at: string | null; last_error: string | null };

export async function syncStatus(tenant: string): Promise<SyncStatus[]> {
  const configured = new Set(connectorsFor(tenant).map((c) => c.source));
  const rows = await q<Omit<SyncStatus, "source" | "label" | "configured" | "backfill_start"> & { source: Source }>(
    tenant,
    "select source, synced_from::text as synced_from, synced_until::text as synced_until, last_run_at, last_ok_at, last_error from erp_sync_state where tenant = $1",
    []
  );
  return (["atendente", "mercadolivre", "loja"] as Source[]).map((source) => {
    const r = rows.find((x) => x.source === source);
    return { source, label: SOURCE_LABEL[source], configured: configured.has(source), synced_from: r?.synced_from ?? r?.synced_until ?? null, backfill_start: addDays(todayBr(), -BACKFILL_DAYS()), synced_until: r?.synced_until ?? null, last_run_at: r?.last_run_at ?? null, last_ok_at: r?.last_ok_at ?? null, last_error: r?.last_error ?? null };
  });
}
