import { z } from "zod";
import { HttpError } from "@/lib/tenant";
import { one, q, tx, type Tx } from "@/lib/erp/db";
import {
  accountSchema,
  categorySchema,
  paySchema,
  recurringSchema,
  titleSchema,
  titleUpdateSchema,
} from "@/lib/erp/schemas";
import type { Account, Category, Recurring, Title } from "@/lib/erp/types";

// ---------- datas e parcelas ----------

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonths(iso: string, months: number): string {
  const [y, m, day] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1, 12));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return target.toISOString().slice(0, 10);
}

// Divide o valor em parcelas iguais; os centavos que sobram vão para a primeira.
export function splitAmount(total: number, parts: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / parts);
  const rest = cents - base * parts;
  return Array.from({ length: parts }, (_, i) => (base + (i === 0 ? rest : 0)) / 100);
}

// ---------- categorias ----------

export async function listCategories(tenant: string): Promise<Category[]> {
  return q<Category>(
    tenant,
    `select c.id, c.name, c.kind,
       ((select count(*) from erp_titles t where t.tenant = c.tenant and t.category_id = c.id) +
        (select count(*) from erp_recurring r where r.tenant = c.tenant and r.category_id = c.id))::int as used
       from erp_categories c where c.tenant = $1 order by c.kind desc, lower(c.name)`
  );
}

export async function createCategory(tenant: string, input: z.input<typeof categorySchema>) {
  const v = categorySchema.parse(input);
  const [row] = await q<Category>(
    tenant,
    "insert into erp_categories (tenant, name, kind) values ($1,$2,$3) returning id, name, kind",
    [v.name, v.kind]
  );
  return row;
}

export async function updateCategory(tenant: string, id: string, input: z.input<typeof categorySchema>) {
  const v = categorySchema.parse(input);
  const rows = await q<Category>(
    tenant,
    "update erp_categories set name = $3 where tenant = $1 and id = $2 returning id, name, kind",
    [id, v.name]
  );
  if (!rows[0]) throw new HttpError(404, "Categoria não encontrada.");
  return rows[0];
}

export async function deleteCategory(tenant: string, id: string) {
  const used = await one<{ n: number }>(
    tenant,
    `select ((select count(*) from erp_titles where tenant = $1 and category_id = $2) +
             (select count(*) from erp_recurring where tenant = $1 and category_id = $2))::int as n`,
    [id]
  );
  if (used && used.n > 0) throw new HttpError(409, "Esta categoria já está em uso. Renomeie em vez de excluir.");
  await q(tenant, "delete from erp_categories where tenant = $1 and id = $2", [id]);
}

// ---------- caixas e contas ----------

const BALANCE = `(a.initial_balance
  + coalesce((select sum(t.paid_amount) from erp_titles t where t.tenant = a.tenant and t.account_id = a.id and t.status = 'paid' and t.direction = 'in'), 0)
  - coalesce((select sum(t.paid_amount) from erp_titles t where t.tenant = a.tenant and t.account_id = a.id and t.status = 'paid' and t.direction = 'out'), 0)
)::float8`;

export async function listAccounts(tenant: string): Promise<Account[]> {
  return q<Account>(
    tenant,
    `select a.id, a.name, a.kind, a.initial_balance::float8 as initial_balance, a.active, ${BALANCE} as balance
       from erp_accounts a where a.tenant = $1 order by a.active desc, lower(a.name)`
  );
}

export async function createAccount(tenant: string, input: z.input<typeof accountSchema>) {
  const v = accountSchema.parse(input);
  const [row] = await q<{ id: string }>(
    tenant,
    "insert into erp_accounts (tenant, name, kind, initial_balance, active) values ($1,$2,$3,$4,$5) returning id",
    [v.name, v.kind, v.initial_balance, v.active]
  );
  return (await listAccounts(tenant)).find((a) => a.id === row.id)!;
}

export async function updateAccount(tenant: string, id: string, input: z.input<typeof accountSchema>) {
  const v = accountSchema.parse(input);
  const rows = await q(
    tenant,
    "update erp_accounts set name=$3, kind=$4, initial_balance=$5, active=$6 where tenant = $1 and id = $2 returning id",
    [id, v.name, v.kind, v.initial_balance, v.active]
  );
  if (rows.length === 0) throw new HttpError(404, "Conta não encontrada.");
  return (await listAccounts(tenant)).find((a) => a.id === id)!;
}

export async function deleteAccount(tenant: string, id: string) {
  const used = await one<{ n: number }>(
    tenant,
    "select count(*)::int as n from erp_titles where tenant = $1 and account_id = $2",
    [id]
  );
  if (used && used.n > 0) throw new HttpError(409, "Esta conta já tem movimentações. Desative em vez de excluir.");
  await q(tenant, "delete from erp_accounts where tenant = $1 and id = $2", [id]);
}

async function defaultAccountId(t: Tx): Promise<string | null> {
  const row = await t.one<{ id: string }>(
    "select id from erp_accounts where tenant = $1 and active order by (kind = 'cash') desc, created_at limit 1"
  );
  return row?.id ?? null;
}

// ---------- títulos (contas a receber e a pagar) ----------

export type TitleFilter = {
  direction?: "in" | "out";
  status?: "open" | "overdue" | "paid" | "all";
  from?: string;
  to?: string;
  q?: string;
  partyId?: string;
  categoryId?: string;
  limit?: number;
};

const TITLE_COLS = `t.id, t.direction, t.description, t.party_id, p.name as party_name, t.category_id, c.name as category_name,
  t.account_id, a.name as account_name, t.amount::float8 as amount, t.due_date::text as due_date, t.status,
  t.paid_at::text as paid_at, t.paid_amount::float8 as paid_amount, t.origin_type, t.origin_id,
  t.installment_no, t.installment_total, t.notes,
  (t.status = 'open' and t.due_date < erp_today()) as overdue,
  case when t.status = 'open' and t.due_date < erp_today() then (erp_today() - t.due_date) else 0 end::int as days_late`;

const TITLE_FROM = `erp_titles t
  left join erp_parties p on p.id = t.party_id
  left join erp_categories c on c.id = t.category_id
  left join erp_accounts a on a.id = t.account_id`;

export async function listTitles(tenant: string, f: TitleFilter = {}): Promise<Title[]> {
  const where = ["t.tenant = $1", "t.status <> 'canceled'"];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replace("?", `$${params.length + 1}`));
  };
  if (f.direction) add("t.direction = ?", f.direction);
  if (f.status === "open") where.push("t.status = 'open'");
  else if (f.status === "overdue") where.push("t.status = 'open' and t.due_date < erp_today()");
  else if (f.status === "paid") where.push("t.status = 'paid'");
  if (f.from) add("t.due_date >= ?::date", f.from);
  if (f.to) add("t.due_date <= ?::date", f.to);
  if (f.partyId) add("t.party_id = ?", f.partyId);
  if (f.categoryId) add("t.category_id = ?", f.categoryId);
  if (f.q?.trim()) {
    params.push(`%${f.q.trim().toLowerCase()}%`);
    where.push(`(lower(t.description) like $${params.length + 1} or lower(p.name) like $${params.length + 1})`);
  }
  params.push(Math.min(f.limit ?? 500, 2000));
  return q<Title>(
    tenant,
    `select ${TITLE_COLS} from ${TITLE_FROM}
      where ${where.join(" and ")}
      order by (t.status = 'paid'), t.due_date, t.created_at
      limit $${params.length + 1}`,
    params
  );
}

export type TitleSummary = {
  open: number;
  open_count: number;
  overdue: number;
  overdue_count: number;
  today: number;
  next7: number;
  paid_month: number;
};

// Totais do topo da tela: em aberto, vencido, vence hoje, próximos 7 dias e já pago no mês.
export async function titleSummary(tenant: string, direction: "in" | "out"): Promise<TitleSummary> {
  const row = await one<TitleSummary>(
    tenant,
    `select
       coalesce(sum(amount) filter (where status = 'open'), 0)::float8 as open,
       count(*) filter (where status = 'open')::int as open_count,
       coalesce(sum(amount) filter (where status = 'open' and due_date < erp_today()), 0)::float8 as overdue,
       count(*) filter (where status = 'open' and due_date < erp_today())::int as overdue_count,
       coalesce(sum(amount) filter (where status = 'open' and due_date = erp_today()), 0)::float8 as today,
       coalesce(sum(amount) filter (where status = 'open' and due_date > erp_today() and due_date <= erp_today() + 7), 0)::float8 as next7,
       coalesce(sum(paid_amount) filter (where status = 'paid' and date_trunc('month', paid_at) = date_trunc('month', erp_today())), 0)::float8 as paid_month
     from erp_titles where tenant = $1 and direction = $2`,
    [direction]
  );
  return row!;
}

async function defaultCategoryId(t: Tx, direction: "in" | "out", name: string): Promise<string | null> {
  const row = await t.one<{ id: string }>(
    "select id from erp_categories where tenant = $1 and kind = $2 and name = $3",
    [direction, name]
  );
  return row?.id ?? null;
}

export { defaultCategoryId };

export type NewTitle = {
  direction: "in" | "out";
  description: string;
  partyId: string | null;
  categoryId: string | null;
  accountId?: string | null;
  amount: number;
  dueDate: string;
  originType: "manual" | "sale" | "purchase" | "recurring";
  originId?: string | null;
  installmentNo?: number | null;
  installmentTotal?: number | null;
  competence?: string | null;
  paid?: { at: string; accountId: string | null } | null;
  notes?: string;
};

export async function insertTitle(t: Tx, n: NewTitle): Promise<string> {
  const [row] = await t.q<{ id: string }>(
    `insert into erp_titles (tenant, direction, description, party_id, category_id, account_id, amount, due_date, status,
        paid_at, paid_amount, origin_type, origin_id, installment_no, installment_total, competence, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning id`,
    [
      n.direction, n.description, n.partyId, n.categoryId, n.paid ? n.paid.accountId : null, n.amount, n.dueDate,
      n.paid ? "paid" : "open", n.paid?.at ?? null, n.paid ? n.amount : null, n.originType, n.originId ?? null,
      n.installmentNo ?? null, n.installmentTotal ?? null, n.competence ?? null, n.notes ?? "",
    ]
  );
  return row.id;
}

// Lançamento manual, com opção de parcelar (mensal) e de já nascer pago.
export async function createTitles(tenant: string, input: z.input<typeof titleSchema>): Promise<Title[]> {
  const v = titleSchema.parse(input);
  const ids = await tx(tenant, async (t) => {
    const accountId = v.paid_now ? (v.account_id ?? (await defaultAccountId(t))) : null;
    if (v.paid_now && !accountId) throw new HttpError(409, "Cadastre um caixa ou conta antes de registrar o pagamento.");
    const amounts = splitAmount(v.amount, v.installments);
    const out: string[] = [];
    for (let i = 0; i < v.installments; i++) {
      out.push(
        await insertTitle(t, {
          direction: v.direction,
          description: v.description,
          partyId: v.party_id,
          categoryId: v.category_id,
          amount: amounts[i],
          dueDate: addMonths(v.due_date, i),
          originType: "manual",
          installmentNo: v.installments > 1 ? i + 1 : null,
          installmentTotal: v.installments > 1 ? v.installments : null,
          paid: v.paid_now && i === 0 ? { at: v.due_date, accountId } : null,
          notes: v.notes,
        })
      );
    }
    return out;
  });
  return listTitlesByIds(tenant, ids);
}

export async function listTitlesByIds(tenant: string, ids: string[]): Promise<Title[]> {
  if (ids.length === 0) return [];
  return q<Title>(
    tenant,
    `select ${TITLE_COLS} from ${TITLE_FROM} where t.tenant = $1 and t.id = any($2::uuid[]) order by t.due_date`,
    [ids]
  );
}

export async function getTitle(tenant: string, id: string): Promise<Title> {
  const [row] = await listTitlesByIds(tenant, [id]);
  if (!row) throw new HttpError(404, "Lançamento não encontrado.");
  return row;
}

export async function updateTitle(tenant: string, id: string, input: z.input<typeof titleUpdateSchema>): Promise<Title> {
  const v = titleUpdateSchema.parse(input);
  const cur = await getTitle(tenant, id);
  if (cur.status !== "open") throw new HttpError(409, "Só dá para editar lançamentos em aberto. Desfaça o pagamento primeiro.");
  // valor e descrição de vendas/compras vêm do pedido; aqui só vencimento, categoria e observação
  const fromOrder = cur.origin_type === "sale" || cur.origin_type === "purchase";
  await q(
    tenant,
    `update erp_titles set description = $3, party_id = $4, category_id = $5, amount = $6, due_date = $7, notes = $8, updated_at = now()
      where tenant = $1 and id = $2`,
    [
      id,
      fromOrder ? cur.description : (v.description ?? cur.description),
      fromOrder ? cur.party_id : v.party_id === undefined ? cur.party_id : v.party_id,
      v.category_id === undefined ? cur.category_id : v.category_id,
      fromOrder ? cur.amount : (v.amount ?? cur.amount),
      v.due_date ?? cur.due_date,
      v.notes ?? cur.notes,
    ]
  );
  return getTitle(tenant, id);
}

export async function payTitle(tenant: string, id: string, input: z.input<typeof paySchema>): Promise<Title> {
  const v = paySchema.parse(input);
  const acc = await one(tenant, "select 1 as ok from erp_accounts where tenant = $1 and id = $2", [v.account_id]);
  if (!acc) throw new HttpError(404, "Conta ou caixa não encontrado.");
  const rows = await q(
    tenant,
    `update erp_titles set status = 'paid', paid_at = $3, paid_amount = $4, account_id = $5, updated_at = now()
      where tenant = $1 and id = $2 and status = 'open' returning id`,
    [id, v.paid_at, v.paid_amount, v.account_id]
  );
  if (rows.length === 0) throw new HttpError(409, "Este lançamento já foi pago ou cancelado.");
  return getTitle(tenant, id);
}

export async function unpayTitle(tenant: string, id: string): Promise<Title> {
  const rows = await q(
    tenant,
    `update erp_titles set status = 'open', paid_at = null, paid_amount = null, updated_at = now()
      where tenant = $1 and id = $2 and status = 'paid' returning id`,
    [id]
  );
  if (rows.length === 0) throw new HttpError(409, "Este lançamento não está pago.");
  return getTitle(tenant, id);
}

// Cancela (nunca apaga): o histórico das vendas continua explicando o que aconteceu.
export async function cancelTitle(tenant: string, id: string): Promise<void> {
  const cur = await getTitle(tenant, id);
  if (cur.status === "paid") throw new HttpError(409, "Este lançamento já foi pago. Desfaça o pagamento antes de cancelar.");
  if (cur.origin_type === "sale" || cur.origin_type === "purchase") {
    throw new HttpError(409, "Esta parcela pertence a um pedido. Cancele o pedido para cancelar as parcelas.");
  }
  await q(tenant, "update erp_titles set status = 'canceled', updated_at = now() where tenant = $1 and id = $2", [id]);
}

// ---------- recorrências ----------

const thisMonth = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 7);

export async function listRecurring(tenant: string): Promise<Recurring[]> {
  return q<Recurring>(
    tenant,
    `select r.id, r.direction, r.description, r.party_id, p.name as party_name, r.category_id, c.name as category_name,
            r.amount::float8 as amount, r.day, r.active,
            exists (select 1 from erp_titles t where t.tenant = r.tenant and t.origin_type = 'recurring' and t.origin_id = r.id
                      and t.competence = $2 and t.status <> 'canceled') as generated_this_month
       from erp_recurring r
       left join erp_parties p on p.id = r.party_id
       left join erp_categories c on c.id = r.category_id
      where r.tenant = $1 order by r.direction desc, r.day, lower(r.description)`,
    [thisMonth()]
  );
}

export async function createRecurring(tenant: string, input: z.input<typeof recurringSchema>) {
  const v = recurringSchema.parse(input);
  const [row] = await q<{ id: string }>(
    tenant,
    `insert into erp_recurring (tenant, direction, description, party_id, category_id, amount, day, active)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
    [v.direction, v.description, v.party_id, v.category_id, v.amount, v.day, v.active]
  );
  return (await listRecurring(tenant)).find((r) => r.id === row.id)!;
}

export async function updateRecurring(tenant: string, id: string, input: z.input<typeof recurringSchema>) {
  const v = recurringSchema.parse(input);
  const rows = await q(
    tenant,
    `update erp_recurring set direction=$3, description=$4, party_id=$5, category_id=$6, amount=$7, day=$8, active=$9
      where tenant = $1 and id = $2 returning id`,
    [id, v.direction, v.description, v.party_id, v.category_id, v.amount, v.day, v.active]
  );
  if (rows.length === 0) throw new HttpError(404, "Recorrência não encontrada.");
  return (await listRecurring(tenant)).find((r) => r.id === id)!;
}

export async function deleteRecurring(tenant: string, id: string) {
  await q(tenant, "delete from erp_recurring where tenant = $1 and id = $2", [id]);
}

// Cria os lançamentos do mês (AAAA-MM) que ainda não existem. Repetir é seguro.
export async function generateRecurring(tenant: string, month = thisMonth()): Promise<{ created: number }> {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, "Mês inválido.");
  return tx(tenant, async (t) => {
    const items = await t.q<{
      id: string; direction: "in" | "out"; description: string; party_id: string | null; category_id: string | null; amount: number; day: number;
    }>(
      `select id, direction, description, party_id, category_id, amount::float8 as amount, day
         from erp_recurring where tenant = $1 and active`
    );
    let created = 0;
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (const r of items) {
      const due = `${month}-${String(Math.min(r.day, lastDay)).padStart(2, "0")}`;
      const rows = await t.q(
        `insert into erp_titles (tenant, direction, description, party_id, category_id, amount, due_date, origin_type, origin_id, competence)
         values ($1,$2,$3,$4,$5,$6,$7,'recurring',$8,$9)
         on conflict (origin_id, competence) where origin_type = 'recurring' and status <> 'canceled' do nothing
         returning id`,
        [r.direction, r.description, r.party_id, r.category_id, r.amount, due, r.id, month]
      );
      created += rows.length;
    }
    return { created };
  });
}
