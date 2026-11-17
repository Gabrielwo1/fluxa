import { z } from "zod";
import { HttpError } from "@/lib/tenant";
import { one, q } from "@/lib/erp/db";
import { digits } from "@/lib/erp/validators";
import { MEI_ANNUAL_LIMIT } from "@/lib/erp/mei";
import type { Invoice, InvoiceSummary } from "@/lib/erp/types";
import { lerNfse, XmlInvalidoError } from "@/lib/nfse/xml";
import { gerarDanfse } from "@/lib/nfse/danfse";

const COLS = `i.id, i.sale_id, s.number as sale_number, i.number, i.access_key, i.issue_date::text as issue_date,
  i.amount::float8 as amount, i.customer_name, i.customer_document, i.description, i.source, i.status,
  (i.xml is not null) as has_xml, i.notes`;

export async function listInvoices(tenant: string, f: { q?: string; year?: number; saleId?: string } = {}): Promise<Invoice[]> {
  const where = ["i.tenant = $1"];
  const params: unknown[] = [];
  if (f.year) {
    params.push(f.year);
    where.push(`extract(year from i.issue_date) = $${params.length + 1}`);
  }
  if (f.saleId) {
    params.push(f.saleId);
    where.push(`i.sale_id = $${params.length + 1}`);
  }
  if (f.q?.trim()) {
    params.push(`%${f.q.trim().toLowerCase()}%`);
    where.push(`(lower(i.customer_name) like $${params.length + 1} or i.number like $${params.length + 1} or i.customer_document like $${params.length + 1})`);
  }
  return q<Invoice>(
    tenant,
    `select ${COLS} from erp_invoices i left join erp_sales s on s.id = i.sale_id
      where ${where.join(" and ")} order by i.issue_date desc, i.created_at desc limit 500`,
    params
  );
}

export async function invoicesOfSale(tenant: string, saleId: string): Promise<Invoice[]> {
  return listInvoices(tenant, { saleId });
}

// Totais do ano (para o limite do MEI) e as vendas confirmadas que ainda não têm nota.
export async function invoiceSummary(tenant: string): Promise<InvoiceSummary> {
  const year = Number(new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 4));
  const totals = await one<{ issued: number; cnt: number; sales: number }>(
    tenant,
    `select
       coalesce((select sum(amount) from erp_invoices where tenant = $1 and status = 'issued' and extract(year from issue_date) = $2), 0)::float8 as issued,
       (select count(*) from erp_invoices where tenant = $1 and status = 'issued' and extract(year from issue_date) = $2)::int as cnt,
       coalesce((select sum(total) from erp_sales where tenant = $1 and status = 'confirmed' and extract(year from issue_date) = $2), 0)::float8 as sales`,
    [year]
  );
  const pending = await q<InvoiceSummary["pending_sales"][number]>(
    tenant,
    `select s.id, s.number, p.name as customer_name, coalesce(p.document, '') as customer_document, s.total::float8 as total,
            s.issue_date::text as issue_date, (length(coalesce(p.document, '')) = 14) as has_company_customer
       from erp_sales s left join erp_parties p on p.id = s.customer_id
      where s.tenant = $1 and s.status = 'confirmed' and s.total > 0
        and not exists (select 1 from erp_invoices i where i.sale_id = s.id and i.status = 'issued')
      order by (length(coalesce(p.document, '')) = 14) desc, s.issue_date desc limit 30`
  );
  return {
    year,
    issued_year: totals!.issued,
    issued_count: totals!.cnt,
    limit: MEI_ANNUAL_LIMIT,
    sales_year: totals!.sales,
    pending_sales: pending,
  };
}

const manualSchema = z.object({
  sale_id: z.uuid().nullable().default(null),
  number: z.string().trim().min(1, "Informe o número da nota.").max(40),
  access_key: z.string().trim().max(60).default(""),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  amount: z.coerce.number({ error: "Informe o valor." }).min(0, "O valor não pode ser negativo.").max(1e10),
  customer_name: z.string().trim().max(200).default(""),
  customer_document: z.string().trim().max(20).default(""),
  description: z.string().trim().max(2000).default(""),
  notes: z.string().trim().max(2000).default(""),
});

async function assertSale(tenant: string, saleId: string | null) {
  if (!saleId) return;
  const sale = await one(tenant, "select 1 as ok from erp_sales where tenant = $1 and id = $2", [saleId]);
  if (!sale) throw new HttpError(404, "Venda não encontrada.");
}

async function insert(
  tenant: string,
  v: {
    sale_id: string | null; number: string; access_key: string; issue_date: string; amount: number;
    customer_name: string; customer_document: string; description: string; notes: string;
    xml: string | null; source: "xml" | "manual";
  }
): Promise<string> {
  try {
    const [row] = await q<{ id: string }>(
      tenant,
      `insert into erp_invoices (tenant, sale_id, number, access_key, issue_date, amount, customer_name, customer_document, description, xml, source, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
      [v.sale_id, v.number, v.access_key, v.issue_date, v.amount, v.customer_name, v.customer_document, v.description, v.xml, v.source, v.notes]
    );
    return row.id;
  } catch (e) {
    if ((e as { constraint?: string }).constraint === "erp_invoices_key_uq") {
      throw new HttpError(409, "Esta nota já foi registrada (mesma chave de acesso).");
    }
    throw e;
  }
}

async function getOne(tenant: string, id: string): Promise<Invoice> {
  const [row] = await q<Invoice>(
    tenant,
    `select ${COLS} from erp_invoices i left join erp_sales s on s.id = i.sale_id where i.tenant = $1 and i.id = $2`,
    [id]
  );
  if (!row) throw new HttpError(404, "Nota não encontrada.");
  return row;
}

// Registra a nota a partir do XML baixado do Emissor Nacional: número, chave, valor, cliente e
// descrição vêm do próprio arquivo. Confere se a nota é do CNPJ desta empresa.
export async function registerFromXml(tenant: string, xml: string, saleId: string | null = null): Promise<Invoice> {
  if (xml.length > 400_000) throw new HttpError(400, "Arquivo grande demais para ser uma nota.");
  let nota;
  try {
    nota = lerNfse(xml);
  } catch (e) {
    if (e instanceof XmlInvalidoError) throw new HttpError(400, `Este arquivo não parece uma NFS-e do Emissor Nacional (${e.message}).`);
    throw e;
  }
  const company = await one<{ document: string }>(tenant, "select document from erp_company where tenant = $1");
  if (company?.document && digits(company.document) !== digits(nota.prestadorDocumento)) {
    throw new HttpError(409, "Esta nota foi emitida por outro CNPJ, diferente do cadastrado em Configurações.");
  }
  await assertSale(tenant, saleId);
  const id = await insert(tenant, {
    sale_id: saleId,
    number: nota.numeroNfse ?? String(nota.numeroDps),
    access_key: nota.chaveAcesso,
    issue_date: nota.competencia,
    amount: nota.valor,
    customer_name: nota.tomadorNome,
    customer_document: nota.tomadorDocumento,
    description: nota.descricao.slice(0, 2000),
    notes: "",
    xml,
    source: "xml",
  });
  return getOne(tenant, id);
}

export async function registerManual(tenant: string, input: z.input<typeof manualSchema>): Promise<Invoice> {
  const v = manualSchema.parse(input);
  await assertSale(tenant, v.sale_id);
  const id = await insert(tenant, { ...v, customer_document: digits(v.customer_document), access_key: digits(v.access_key), xml: null, source: "manual" });
  return getOne(tenant, id);
}

export async function updateInvoice(tenant: string, id: string, patch: { sale_id?: string | null; status?: "issued" | "canceled"; notes?: string }): Promise<Invoice> {
  const cur = await getOne(tenant, id);
  if (patch.sale_id !== undefined) await assertSale(tenant, patch.sale_id);
  await q(
    tenant,
    "update erp_invoices set sale_id = $3, status = $4, notes = $5, updated_at = now() where tenant = $1 and id = $2",
    [id, patch.sale_id === undefined ? cur.sale_id : patch.sale_id, patch.status ?? cur.status, patch.notes ?? cur.notes]
  );
  return getOne(tenant, id);
}

export async function deleteInvoice(tenant: string, id: string): Promise<void> {
  await getOne(tenant, id);
  await q(tenant, "delete from erp_invoices where tenant = $1 and id = $2", [id]);
}

export async function invoiceXml(tenant: string, id: string): Promise<{ xml: string; name: string }> {
  const row = await one<{ xml: string | null; number: string }>(tenant, "select xml, number from erp_invoices where tenant = $1 and id = $2", [id]);
  if (!row) throw new HttpError(404, "Nota não encontrada.");
  if (!row.xml) throw new HttpError(404, "Esta nota foi registrada à mão e não tem XML.");
  return { xml: row.xml, name: `nfse-${row.number || id.slice(0, 8)}.xml` };
}

// O PDF (DANFSe) é gerado do XML guardado, no mesmo desenho do portal.
export async function invoicePdf(tenant: string, id: string): Promise<{ pdf: Uint8Array; name: string }> {
  const { xml, name } = await invoiceXml(tenant, id);
  const row = await one<{ status: string }>(tenant, "select status from erp_invoices where tenant = $1 and id = $2", [id]);
  const pdf = await gerarDanfse(xml, { situacao: row?.status === "canceled" ? "cancelada" : "normal" });
  return { pdf, name: name.replace(/\.xml$/, ".pdf") };
}
