import { z } from "zod";
import { HttpError } from "@/lib/tenant";
import { one, q } from "@/lib/erp/db";
import { partySchema } from "@/lib/erp/schemas";
import type { Party, Sale, Title } from "@/lib/erp/types";

export type PartyFilter = {
  kind?: "customer" | "supplier";
  q?: string;
  status?: string;
  limit?: number;
};

const COLS = `p.id, p.is_customer, p.is_supplier, p.person_type, p.name, p.trade_name, p.document, p.email, p.phone,
  p.zip, p.street, p.number, p.complement, p.district, p.city, p.state, p.notes, p.status, p.demo, p.created_at`;

export async function listParties(tenant: string, f: PartyFilter = {}): Promise<Party[]> {
  const where: string[] = ["p.tenant = $1"];
  const params: unknown[] = [];
  if (f.kind === "customer") where.push("p.is_customer");
  if (f.kind === "supplier") where.push("p.is_supplier");
  if (f.status && f.status !== "all") {
    params.push(f.status);
    where.push(`p.status = $${params.length + 1}`);
  }
  if (f.q?.trim()) {
    params.push(`%${f.q.trim().toLowerCase()}%`);
    const n = params.length + 1;
    where.push(
      `(lower(p.name) like $${n} or lower(p.trade_name) like $${n} or p.document like $${n} or lower(p.email) like $${n} or p.phone like $${n})`
    );
  }
  params.push(Math.min(f.limit ?? 500, 1000));
  return q<Party>(
    tenant,
    `select ${COLS},
       coalesce(s.total, 0)::float8 as sales_total, coalesce(s.cnt, 0)::int as sales_count, s.last_sale::text as last_sale,
       coalesce(t.open_in, 0)::float8 as open_receivable, coalesce(t.late_in, 0)::float8 as overdue_receivable,
       coalesce(t.open_out, 0)::float8 as open_payable
     from erp_parties p
     left join lateral (
       select sum(total) as total, count(*) as cnt, max(issue_date) as last_sale
         from erp_sales where tenant = p.tenant and customer_id = p.id and status = 'confirmed'
     ) s on true
     left join lateral (
       select sum(amount) filter (where direction = 'in') as open_in,
              sum(amount) filter (where direction = 'in' and due_date < erp_today()) as late_in,
              sum(amount) filter (where direction = 'out') as open_out
         from erp_titles where tenant = p.tenant and party_id = p.id and status = 'open'
     ) t on true
     where ${where.join(" and ")}
     order by lower(p.name)
     limit $${params.length + 1}`,
    params
  );
}

export async function getParty(tenant: string, id: string) {
  const [party] = await q<Party>(tenant, `select ${COLS} from erp_parties p where p.tenant = $1 and p.id = $2`, [id]);
  if (!party) throw new HttpError(404, "Cadastro não encontrado.");
  const sales = await q<Sale>(
    tenant,
    `select id, number, status, issue_date::text, total::float8 as total, payment_method
       from erp_sales where tenant = $1 and customer_id = $2 order by issue_date desc, number desc limit 20`,
    [id]
  );
  const titles = await q<Title>(
    tenant,
    `select id, direction, description, amount::float8 as amount, due_date::text, status, paid_at::text,
            (status = 'open' and due_date < erp_today()) as overdue
       from erp_titles where tenant = $1 and party_id = $2 and status <> 'canceled'
      order by due_date desc limit 30`,
    [id]
  );
  return { party, sales, titles };
}

async function assertUniqueDocument(tenant: string, document: string, exceptId?: string) {
  if (!document) return;
  const dup = await one<{ name: string }>(
    tenant,
    `select name from erp_parties where tenant = $1 and document = $2 and ($3::uuid is null or id <> $3::uuid) limit 1`,
    [document, exceptId ?? null]
  );
  if (dup) throw new HttpError(409, `Já existe um cadastro com este CPF/CNPJ: ${dup.name}.`);
}

export async function createParty(tenant: string, input: z.input<typeof partySchema>): Promise<Party> {
  const v = partySchema.parse(input);
  await assertUniqueDocument(tenant, v.document);
  const [row] = await q<{ id: string }>(
    tenant,
    `insert into erp_parties (tenant, is_customer, is_supplier, person_type, name, trade_name, document, email, phone,
       zip, street, number, complement, district, city, state, notes, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) returning id`,
    [v.is_customer, v.is_supplier, v.person_type, v.name, v.trade_name, v.document, v.email, v.phone, v.zip, v.street,
     v.number, v.complement, v.district, v.city, v.state, v.notes, v.status]
  );
  return (await getParty(tenant, row.id)).party;
}

export async function updateParty(tenant: string, id: string, input: z.input<typeof partySchema>): Promise<Party> {
  const v = partySchema.parse(input);
  await assertUniqueDocument(tenant, v.document, id);
  const rows = await q(
    tenant,
    `update erp_parties set is_customer=$3, is_supplier=$4, person_type=$5, name=$6, trade_name=$7, document=$8, email=$9,
       phone=$10, zip=$11, street=$12, number=$13, complement=$14, district=$15, city=$16, state=$17, notes=$18,
       status=$19, updated_at=now()
     where tenant = $1 and id = $2 returning id`,
    [id, v.is_customer, v.is_supplier, v.person_type, v.name, v.trade_name, v.document, v.email, v.phone, v.zip, v.street,
     v.number, v.complement, v.district, v.city, v.state, v.notes, v.status]
  );
  if (rows.length === 0) throw new HttpError(404, "Cadastro não encontrado.");
  return (await getParty(tenant, id)).party;
}

// Quem já tem histórico não pode ser apagado (as vendas e contas perderiam o nome): arquive.
export async function deleteParty(tenant: string, id: string): Promise<void> {
  const used = await one<{ n: number }>(
    tenant,
    `select (
        (select count(*) from erp_sales where tenant = $1 and customer_id = $2) +
        (select count(*) from erp_purchases where tenant = $1 and supplier_id = $2) +
        (select count(*) from erp_titles where tenant = $1 and party_id = $2) +
        (select count(*) from erp_recurring where tenant = $1 and party_id = $2)
      )::int as n`,
    [id]
  );
  if (used && used.n > 0) {
    throw new HttpError(409, "Este cadastro já tem vendas, compras ou contas. Arquive em vez de excluir.");
  }
  const rows = await q(tenant, "delete from erp_parties where tenant = $1 and id = $2 returning id", [id]);
  if (rows.length === 0) throw new HttpError(404, "Cadastro não encontrado.");
}
