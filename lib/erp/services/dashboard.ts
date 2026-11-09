import { q, one } from "@/lib/erp/db";

export type Dashboard = {
  month: string;
  sales: { total: number; prev: number; count: number; ticket: number; quotes_open: number; quotes_value: number };
  receivable: { open: number; overdue: number; overdue_count: number; today: number; next7: number };
  payable: { open: number; overdue: number; overdue_count: number; today: number; next7: number };
  cash: { balance: number; received_month: number; paid_month: number };
  stock: { low: number; value: number; products: number };
  customers: { total: number; new_month: number; leads: number };
  series: { month: string; sales: number; received: number; paid: number }[];
  top_customers: { id: string; name: string; total: number }[];
  top_products: { id: string | null; name: string; total: number; qty: number }[];
  todo: {
    overdue_titles: { id: string; direction: "in" | "out"; description: string; party: string | null; amount: number; days_late: number }[];
    due_today: { id: string; direction: "in" | "out"; description: string; party: string | null; amount: number }[];
    low_stock: { id: string; name: string; stock: number; min_stock: number; unit: string }[];
    old_quotes: { id: string; number: number; customer: string | null; total: number; days: number }[];
    recurring_pending: number;
  };
  setup: {
    company: boolean;
    products: number;
    customers: number;
    sales: number;
    titles: number;
    has_demo: boolean;
  };
};

export async function getDashboard(tenant: string): Promise<Dashboard> {
  const STOCK = `coalesce((select sum(m.qty) from erp_stock_moves m where m.tenant = p.tenant and m.product_id = p.id), 0)`;

  const kpi = await one<{
    month: string; sales_total: number; sales_prev: number; sales_count: number; quotes_open: number; quotes_value: number;
    received_month: number; paid_month: number; cash: number;
    c_total: number; c_new: number; c_leads: number;
    low: number; stock_value: number; products: number;
    company: boolean; titles: number; sales_all: number; has_demo: boolean; rec_pending: number;
  }>(
    tenant,
    `select
       to_char(date_trunc('month', erp_today()), 'YYYY-MM') as month,
       coalesce((select sum(total) from erp_sales where tenant = $1 and status = 'confirmed' and date_trunc('month', issue_date) = date_trunc('month', erp_today())), 0)::float8 as sales_total,
       coalesce((select sum(total) from erp_sales where tenant = $1 and status = 'confirmed' and date_trunc('month', issue_date) = date_trunc('month', erp_today()) - interval '1 month'), 0)::float8 as sales_prev,
       (select count(*) from erp_sales where tenant = $1 and status = 'confirmed' and date_trunc('month', issue_date) = date_trunc('month', erp_today()))::int as sales_count,
       (select count(*) from erp_sales where tenant = $1 and status = 'quote')::int as quotes_open,
       coalesce((select sum(total) from erp_sales where tenant = $1 and status = 'quote'), 0)::float8 as quotes_value,
       coalesce((select sum(paid_amount) from erp_titles where tenant = $1 and direction = 'in' and status = 'paid' and date_trunc('month', paid_at) = date_trunc('month', erp_today())), 0)::float8 as received_month,
       coalesce((select sum(paid_amount) from erp_titles where tenant = $1 and direction = 'out' and status = 'paid' and date_trunc('month', paid_at) = date_trunc('month', erp_today())), 0)::float8 as paid_month,
       (coalesce((select sum(initial_balance) from erp_accounts where tenant = $1 and active), 0)
        + coalesce((select sum(case when t.direction = 'in' then t.paid_amount else -t.paid_amount end) from erp_titles t join erp_accounts a on a.id = t.account_id where t.tenant = $1 and t.status = 'paid' and a.active), 0))::float8 as cash,
       (select count(*) from erp_parties where tenant = $1 and is_customer and status <> 'inactive')::int as c_total,
       (select count(*) from erp_parties where tenant = $1 and is_customer and date_trunc('month', created_at) = date_trunc('month', now()))::int as c_new,
       (select count(*) from erp_parties where tenant = $1 and is_customer and status = 'lead')::int as c_leads,
       (select count(*) from erp_products p where p.tenant = $1 and p.active and p.track_stock and ${STOCK} <= p.min_stock)::int as low,
       coalesce((select sum(greatest(${STOCK}, 0) * p.cost_price) from erp_products p where p.tenant = $1 and p.track_stock), 0)::float8 as stock_value,
       (select count(*) from erp_products where tenant = $1 and active)::int as products,
       (select name <> '' from erp_company where tenant = $1) as company,
       (select count(*) from erp_titles where tenant = $1)::int as titles,
       (select count(*) from erp_sales where tenant = $1 and status <> 'canceled')::int as sales_all,
       (select has_demo from erp_company where tenant = $1) as has_demo,
       (select count(*) from erp_recurring r where r.tenant = $1 and r.active and not exists (
           select 1 from erp_titles t where t.tenant = r.tenant and t.origin_type = 'recurring' and t.origin_id = r.id
              and t.competence = to_char(erp_today(), 'YYYY-MM') and t.status <> 'canceled'))::int as rec_pending`
  );
  const k = kpi!;

  const dueSummary = async (direction: "in" | "out") =>
    (await one<{ open: number; overdue: number; overdue_count: number; today: number; next7: number }>(
      tenant,
      `select coalesce(sum(amount), 0)::float8 as open,
              coalesce(sum(amount) filter (where due_date < erp_today()), 0)::float8 as overdue,
              count(*) filter (where due_date < erp_today())::int as overdue_count,
              coalesce(sum(amount) filter (where due_date = erp_today()), 0)::float8 as today,
              coalesce(sum(amount) filter (where due_date > erp_today() and due_date <= erp_today() + 7), 0)::float8 as next7
         from erp_titles where tenant = $1 and direction = $2 and status = 'open'`,
      [direction]
    ))!;

  const series = await q<{ month: string; sales: number; received: number; paid: number }>(
    tenant,
    `with months as (
       select to_char(d, 'YYYY-MM') as month, d as start from generate_series(date_trunc('month', erp_today()) - interval '5 months', date_trunc('month', erp_today()), interval '1 month') d
     )
     select m.month,
       coalesce((select sum(total) from erp_sales where tenant = $1 and status = 'confirmed' and date_trunc('month', issue_date) = m.start), 0)::float8 as sales,
       coalesce((select sum(paid_amount) from erp_titles where tenant = $1 and direction = 'in' and status = 'paid' and date_trunc('month', paid_at) = m.start), 0)::float8 as received,
       coalesce((select sum(paid_amount) from erp_titles where tenant = $1 and direction = 'out' and status = 'paid' and date_trunc('month', paid_at) = m.start), 0)::float8 as paid
     from months m order by m.month`
  );

  const top_customers = await q<{ id: string; name: string; total: number }>(
    tenant,
    `select p.id, p.name, sum(s.total)::float8 as total
       from erp_sales s join erp_parties p on p.id = s.customer_id
      where s.tenant = $1 and s.status = 'confirmed' and s.issue_date >= erp_today() - 90
      group by p.id, p.name order by total desc limit 5`
  );
  const top_products = await q<{ id: string | null; name: string; total: number; qty: number }>(
    tenant,
    `select i.product_id as id, max(i.description) as name, sum(i.total)::float8 as total, sum(i.qty)::float8 as qty
       from erp_sale_items i join erp_sales s on s.id = i.sale_id
      where s.tenant = $1 and s.status = 'confirmed' and s.issue_date >= erp_today() - 90
      group by i.product_id, lower(i.description) order by total desc limit 5`
  );

  const overdue_titles = await q<Dashboard["todo"]["overdue_titles"][number]>(
    tenant,
    `select t.id, t.direction, t.description, p.name as party, t.amount::float8 as amount, (erp_today() - t.due_date)::int as days_late
       from erp_titles t left join erp_parties p on p.id = t.party_id
      where t.tenant = $1 and t.status = 'open' and t.due_date < erp_today()
      order by t.due_date limit 6`
  );
  const due_today = await q<Dashboard["todo"]["due_today"][number]>(
    tenant,
    `select t.id, t.direction, t.description, p.name as party, t.amount::float8 as amount
       from erp_titles t left join erp_parties p on p.id = t.party_id
      where t.tenant = $1 and t.status = 'open' and t.due_date = erp_today() order by t.direction desc limit 6`
  );
  const low_stock = await q<Dashboard["todo"]["low_stock"][number]>(
    tenant,
    `select * from (
       select p.id, p.name, ${STOCK}::float8 as stock, p.min_stock::float8 as min_stock, p.unit
         from erp_products p where p.tenant = $1 and p.active and p.track_stock
     ) x where stock <= min_stock order by (stock - min_stock) limit 6`
  );
  const old_quotes = await q<Dashboard["todo"]["old_quotes"][number]>(
    tenant,
    `select s.id, s.number, p.name as customer, s.total::float8 as total, (erp_today() - s.issue_date)::int as days
       from erp_sales s left join erp_parties p on p.id = s.customer_id
      where s.tenant = $1 and s.status = 'quote' and s.issue_date <= erp_today() - 3
      order by s.issue_date limit 5`
  );

  return {
    month: k.month,
    sales: {
      total: k.sales_total,
      prev: k.sales_prev,
      count: k.sales_count,
      ticket: k.sales_count ? k.sales_total / k.sales_count : 0,
      quotes_open: k.quotes_open,
      quotes_value: k.quotes_value,
    },
    receivable: await dueSummary("in"),
    payable: await dueSummary("out"),
    cash: { balance: k.cash, received_month: k.received_month, paid_month: k.paid_month },
    stock: { low: k.low, value: k.stock_value, products: k.products },
    customers: { total: k.c_total, new_month: k.c_new, leads: k.c_leads },
    series,
    top_customers,
    top_products,
    todo: { overdue_titles, due_today, low_stock, old_quotes, recurring_pending: k.rec_pending },
    setup: {
      company: k.company,
      products: k.products,
      customers: k.c_total,
      sales: k.sales_all,
      titles: k.titles,
      has_demo: k.has_demo,
    },
  };
}
