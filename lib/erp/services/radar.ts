import { q } from "@/lib/erp/db";
import { radarJson, type RadarList } from "@/lib/radar/api";

// Cruzamento entre o cadastro do Fluxa e a base de empresas do Radar (Receita Federal).
// Tudo roda no servidor e só olha a empresa da sessão (tenant).

export type Known = { party_id: string; name: string; status: "lead" | "active" | "inactive"; is_customer: boolean; is_supplier: boolean; sold: number };

const onlyCnpj = (list: string[]) => [...new Set(list.map((c) => c.replace(/\D/g, "")).filter((c) => c.length === 14))].slice(0, 100);

// Quais destes CNPJs já estão no cadastro (como cliente, lead ou fornecedor) e quanto já vendemos a eles.
export async function knownByCnpj(tenant: string, cnpjs: string[]): Promise<Record<string, Known>> {
  const list = onlyCnpj(cnpjs);
  if (!list.length) return {};
  const rows = await q<{ cnpj: string } & Omit<Known, "sold"> & { sold: string }>(
    tenant,
    `select regexp_replace(p.document, '\\D', '', 'g') as cnpj, p.id as party_id, p.name, p.status, p.is_customer, p.is_supplier,
            coalesce((select sum(s.total) from erp_sales s where s.tenant = $1 and s.customer_id = p.id and s.status = 'confirmed'), 0) as sold
       from erp_parties p
      where p.tenant = $1 and regexp_replace(p.document, '\\D', '', 'g') = any($2)`,
    [list]
  );
  return Object.fromEntries(rows.map((r) => [r.cnpj, { ...r, sold: Number(r.sold) }]));
}

export type Segment = { cnae: number; description: string; customers: number; sold: number };

// Segmentos (CNAE) dos clientes que já compram: ponto de partida para achar empresas parecidas.
export async function customerSegments(tenant: string): Promise<{ segments: Segment[]; matched: number; customers: number }> {
  const customers = await q<{ cnpj: string; sold: string }>(
    tenant,
    `select regexp_replace(p.document, '\\D', '', 'g') as cnpj,
            coalesce((select sum(s.total) from erp_sales s where s.tenant = $1 and s.customer_id = p.id and s.status = 'confirmed'), 0) as sold
       from erp_parties p
      where p.tenant = $1 and p.is_customer and p.status <> 'inactive' and length(regexp_replace(p.document, '\\D', '', 'g')) = 14
      order by sold desc limit 100`,
    []
  );
  if (!customers.length) return { segments: [], matched: 0, customers: 0 };
  const sold = new Map(customers.map((c) => [c.cnpj, Number(c.sold)]));
  const found = await radarJson<RadarList>(`empresas?cnpjs=${[...sold.keys()].join(",")}&limit=100`);
  const by = new Map<number, Segment>();
  for (const e of found.resultados) {
    if (!e.cnae_principal) continue;
    const s = by.get(e.cnae_principal) ?? { cnae: e.cnae_principal, description: e.cnae_descricao ?? String(e.cnae_principal), customers: 0, sold: 0 };
    s.customers += 1;
    s.sold += sold.get(e.cnpj) ?? 0;
    by.set(e.cnae_principal, s);
  }
  const segments = [...by.values()].sort((a, b) => b.customers - a.customers || b.sold - a.sold).slice(0, 6);
  return { segments, matched: found.resultados.length, customers: customers.length };
}
