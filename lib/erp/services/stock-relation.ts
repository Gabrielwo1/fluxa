import { HttpError } from "@/lib/tenant";
import { q, tx } from "@/lib/erp/db";
import { addMove } from "@/lib/erp/services/stock";

// Relação de estoque: cada produto com tudo o que já foi vendido (por canal), o ritmo de venda, o saldo
// que o Fluxa controla e quantos dias ele dura. Serve para decidir o que repor e o que está parado.

export const CHANNELS = ["mercadolivre", "loja", "whatsapp", "balcao"] as const;
export type Channel = (typeof CHANNELS)[number];

export type RelationStatus = "sem_controle" | "negativo" | "zerado" | "repor" | "sem_giro" | "ok";

export type RelationRow = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  track_stock: boolean;
  min_stock: number;
  // saldo do Fluxa; null enquanto o produto não tem controle de estoque
  stock: number | null;
  sold_total: number;
  sold_period: number;
  by_channel: Record<Channel, number>;
  per_day: number;
  // dias que o saldo dura no ritmo atual (null sem saldo ou sem vendas no período)
  cover_days: number | null;
  // quanto comprar para cobrir 30 dias no ritmo atual (já descontando o saldo negativo, se houver)
  suggested: number;
  last_sale: string | null;
  status: RelationStatus;
};

export type Relation = { days: number; since: string; rows: RelationRow[] };

const todayBr = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export function statusOf(r: { track_stock: boolean; stock: number | null; min_stock: number; sold_period: number; per_day: number; cover_days: number | null }): RelationStatus {
  if (!r.track_stock || r.stock === null) return "sem_controle";
  if (r.stock < 0) return "negativo";
  if (r.stock === 0) return "zerado";
  if ((r.min_stock > 0 && r.stock <= r.min_stock) || (r.cover_days !== null && r.cover_days <= 7)) return "repor";
  if (r.sold_period === 0) return "sem_giro";
  return "ok";
}

export async function stockRelation(tenant: string, days = 30): Promise<Relation> {
  const d = [7, 30, 90, 180].includes(days) ? days : 30;
  const since = addDays(todayBr(), -(d - 1));
  const rows = await q<Omit<RelationRow, "by_channel" | "per_day" | "cover_days" | "suggested" | "status"> & Record<`ch_${Channel}`, number>>(
    tenant,
    `select p.id, p.sku, p.name, p.unit, p.track_stock, p.min_stock::float8 as min_stock,
       case when p.track_stock then coalesce((select sum(m.qty) from erp_stock_moves m where m.tenant = p.tenant and m.product_id = p.id), 0)::float8 end as stock,
       coalesce(sum(x.qty), 0)::float8 as sold_total,
       coalesce(sum(x.qty) filter (where x.issue_date >= $2::date), 0)::float8 as sold_period,
       coalesce(sum(x.qty) filter (where x.issue_date >= $2::date and x.channel = 'mercadolivre'), 0)::float8 as ch_mercadolivre,
       coalesce(sum(x.qty) filter (where x.issue_date >= $2::date and x.channel = 'loja'), 0)::float8 as ch_loja,
       coalesce(sum(x.qty) filter (where x.issue_date >= $2::date and x.channel = 'whatsapp'), 0)::float8 as ch_whatsapp,
       coalesce(sum(x.qty) filter (where x.issue_date >= $2::date and x.channel not in ('mercadolivre', 'loja', 'whatsapp')), 0)::float8 as ch_balcao,
       max(x.issue_date)::text as last_sale
     from erp_products p
     left join (
       select i.product_id, i.qty, s.issue_date, s.channel
         from erp_sale_items i join erp_sales s on s.id = i.sale_id
        where s.tenant = $1 and s.status = 'confirmed'
     ) x on x.product_id = p.id
     where p.tenant = $1 and p.kind = 'product' and p.active
     group by p.id
     having p.track_stock or coalesce(sum(x.qty), 0) > 0
     order by coalesce(sum(x.qty) filter (where x.issue_date >= $2::date), 0) desc, lower(p.name)`,
    [since]
  );
  return {
    days: d,
    since,
    rows: rows.map((r) => {
      const per_day = round(r.sold_period / d, 2);
      const cover_days = r.stock !== null && r.stock > 0 && per_day > 0 ? Math.floor(r.stock / per_day) : null;
      const by_channel = { mercadolivre: r.ch_mercadolivre, loja: r.ch_loja, whatsapp: r.ch_whatsapp, balcao: r.ch_balcao };
      const base = { id: r.id, sku: r.sku, name: r.name, unit: r.unit, track_stock: r.track_stock, min_stock: r.min_stock, stock: r.stock, sold_total: r.sold_total, sold_period: r.sold_period, by_channel, per_day, cover_days, last_sale: r.last_sale };
      return {
        ...base,
        // saldo negativo conta: para sair do negativo e ainda cobrir 30 dias é preciso comprar o rombo mais o ritmo
        suggested: r.track_stock && per_day > 0 ? Math.max(0, Math.ceil(per_day * 30 - (r.stock ?? 0))) : 0,
        status: statusOf(base),
      };
    }),
  };
}

// Começa a controlar o estoque de um produto a partir de uma contagem. Vendas anteriores a hoje (as que as
// integrações ainda estão trazendo do histórico) já estavam na contagem e não baixam de novo.
export async function startTracking(tenant: string, input: { product_id: string; count: number }) {
  if (!Number.isFinite(input.count) || input.count < 0) throw new HttpError(400, "Informe quanto tem hoje (zero ou mais).");
  return tx(tenant, async (t) => {
    const p = await t.one<{ id: string; track_stock: boolean; cost_price: number; name: string }>(
      "select id, track_stock, cost_price::float8 as cost_price, name from erp_products where tenant = $1 and id = $2",
      [input.product_id]
    );
    if (!p) throw new HttpError(404, "Produto não encontrado.");
    if (p.track_stock) throw new HttpError(409, `"${p.name}" já controla estoque. Use Ajustar para fazer uma nova contagem.`);
    await t.q("update erp_products set track_stock = true, stock_since = $2::date, updated_at = now() where tenant = $1 and id = $3", [todayBr(), p.id]);
    if (input.count > 0) await addMove(t, { productId: p.id, qty: input.count, unitCost: p.cost_price, reason: "initial", note: "Contagem inicial" });
    return { id: p.id, stock: input.count };
  });
}

