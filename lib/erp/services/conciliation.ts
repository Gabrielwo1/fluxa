import { one, q } from "@/lib/erp/db";
import { HttpError } from "@/lib/tenant";
import { payTitle } from "@/lib/erp/services/finance";
import type { OpenTitle, ReceivedTitle } from "@/lib/erp/reconcile";

// O lado do ERP da conciliação: vendas, notas e recebimentos por dia, mais as contas a receber em aberto.
// O lado do banco (Open Banking) vem do navegador; o cruzamento é feito na tela (lib/erp/reconcile.ts).

export type ConciliationDay = { date: string; sales: number; sales_count: number; invoices: number; invoices_count: number };
export type SaleWithoutInvoice = { id: string; number: number; customer: string | null; total: number; issue_date: string };
export type InvoiceWithoutSale = { id: string; number: string; customer_name: string; amount: number; issue_date: string };

export type ConciliationData = {
  from: string;
  to: string;
  days: ConciliationDay[];
  received: ReceivedTitle[];
  open: OpenTitle[];
  sales_without_invoice: SaleWithoutInvoice[];
  invoices_without_sale: InvoiceWithoutSale[];
};

const isoDay = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function conciliation(tenant: string, from: string, to: string): Promise<ConciliationData> {
  if (!isoDay(from) || !isoDay(to) || from > to) throw new HttpError(400, "Período inválido.");
  const days = await q<ConciliationDay>(
    tenant,
    `select g.d::date::text as date,
       coalesce(s.total, 0)::float8 as sales, coalesce(s.n, 0)::int as sales_count,
       coalesce(i.total, 0)::float8 as invoices, coalesce(i.n, 0)::int as invoices_count
     from generate_series($2::date, $3::date, interval '1 day') g(d)
     left join (select issue_date, sum(total) as total, count(*) as n from erp_sales
                 where tenant = $1 and status = 'confirmed' group by issue_date) s on s.issue_date = g.d::date
     left join (select issue_date, sum(amount) as total, count(*) as n from erp_invoices
                 where tenant = $1 and status = 'issued' group by issue_date) i on i.issue_date = g.d::date
     order by g.d`,
    [from, to]
  );
  const received = await q<ReceivedTitle>(
    tenant,
    `select id, description, paid_amount::float8 as amount, paid_at::text as paid_at
       from erp_titles where tenant = $1 and direction = 'in' and status = 'paid' and paid_at between $2 and $3
      order by paid_at`,
    [from, to]
  );
  // contas a receber em aberto: as que podem ter caído no banco dentro do período
  const open = await q<OpenTitle>(
    tenant,
    `select t.id, t.description, p.name as party, t.amount::float8 as amount, t.due_date::text as due_date, s.number as sale_number
       from erp_titles t left join erp_parties p on p.id = t.party_id
       left join erp_sales s on s.id = t.origin_id and t.origin_type = 'sale'
      where t.tenant = $1 and t.direction = 'in' and t.status = 'open' and t.due_date <= $2::date + 90
      order by t.due_date limit 500`,
    [to]
  );
  const salesWithout = await q<SaleWithoutInvoice>(
    tenant,
    `select s.id, s.number, p.name as customer, s.total::float8 as total, s.issue_date::text as issue_date
       from erp_sales s left join erp_parties p on p.id = s.customer_id
      where s.tenant = $1 and s.status = 'confirmed' and s.total > 0 and s.issue_date between $2 and $3
        and not exists (select 1 from erp_invoices i where i.sale_id = s.id and i.status = 'issued')
      order by s.issue_date desc limit 200`,
    [from, to]
  );
  const invoicesWithout = await q<InvoiceWithoutSale>(
    tenant,
    `select id, number, customer_name, amount::float8 as amount, issue_date::text as issue_date
       from erp_invoices where tenant = $1 and status = 'issued' and sale_id is null and issue_date between $2 and $3
      order by issue_date desc limit 200`,
    [from, to]
  );
  return { from, to, days, received, open, sales_without_invoice: salesWithout, invoices_without_sale: invoicesWithout };
}

// Dá a baixa numa conta a receber com a data e o valor que o banco mostrou.
export async function settleFromBank(tenant: string, input: { title_id: string; paid_at: string; amount: number }) {
  const account = await one<{ id: string }>(
    tenant,
    "select id from erp_accounts where tenant = $1 and active order by (kind = 'bank') desc, created_at limit 1"
  );
  if (!account) throw new HttpError(409, "Cadastre uma conta ou caixa para registrar o recebimento.");
  return payTitle(tenant, input.title_id, { paid_at: input.paid_at.slice(0, 10), paid_amount: input.amount, account_id: account.id });
}
