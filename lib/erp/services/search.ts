import { q } from "@/lib/erp/db";

export type SearchResults = {
  parties: { id: string; name: string; kind: string; document: string }[];
  products: { id: string; name: string; sku: string; sale_price: number }[];
  sales: { id: string; number: number; customer: string | null; total: number; status: string }[];
  titles: { id: string; description: string; direction: "in" | "out"; amount: number; due_date: string }[];
};

// Busca única para a barra do topo: clientes, produtos, vendas e contas.
export async function searchAll(tenant: string, text: string): Promise<SearchResults> {
  const term = text.trim().toLowerCase();
  if (term.length < 2) return { parties: [], products: [], sales: [], titles: [] };
  const like = `%${term}%`;
  const number = /^#?\d+$/.test(term) ? Number(term.replace("#", "")) : -1;
  const [parties, products, sales, titles] = await Promise.all([
    q<SearchResults["parties"][number]>(
      tenant,
      `select id, name, case when is_customer and is_supplier then 'Cliente e fornecedor' when is_supplier then 'Fornecedor' else 'Cliente' end as kind, document
         from erp_parties where tenant = $1 and (lower(name) like $2 or lower(trade_name) like $2 or document like $2 or lower(email) like $2 or phone like $2)
        order by lower(name) limit 6`,
      [like]
    ),
    q<SearchResults["products"][number]>(
      tenant,
      `select id, name, sku, sale_price::float8 as sale_price from erp_products
        where tenant = $1 and (lower(name) like $2 or lower(sku) like $2) order by lower(name) limit 6`,
      [like]
    ),
    q<SearchResults["sales"][number]>(
      tenant,
      `select s.id, s.number, p.name as customer, s.total::float8 as total, s.status
         from erp_sales s left join erp_parties p on p.id = s.customer_id
        where s.tenant = $1 and (s.number = $3 or lower(p.name) like $2) order by s.issue_date desc limit 6`,
      [like, number]
    ),
    q<SearchResults["titles"][number]>(
      tenant,
      `select id, description, direction, amount::float8 as amount, due_date::text as due_date from erp_titles
        where tenant = $1 and status <> 'canceled' and lower(description) like $2 order by due_date desc limit 6`,
      [like]
    ),
  ]);
  return { parties, products, sales, titles };
}
