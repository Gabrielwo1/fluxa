import { HttpError } from "@/lib/tenant";
import { q } from "@/lib/erp/db";
import type { Report } from "@/lib/erp/types";

import { REPORTS } from "@/lib/erp/report-list";

export { REPORTS };

export type ReportParams = { from?: string; to?: string; group?: string };

const isDate = (v?: string) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));

// Período padrão: do dia 1º do mês até hoje (no horário do Brasil).
function range(p: ReportParams) {
  const now = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const from = isDate(p.from) ? (p.from as string) : `${now.slice(0, 7)}-01`;
  const to = isDate(p.to) ? (p.to as string) : now;
  if (from > to) throw new HttpError(400, "A data inicial não pode ser depois da final.");
  return { from, to };
}

const pctOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

export async function runReport(tenant: string, name: string, params: ReportParams): Promise<Report> {
  const { from, to } = range(params);
  const label = `${from.split("-").reverse().join("/")} a ${to.split("-").reverse().join("/")}`;

  switch (name) {
    case "vendas": {
      const group = ["dia", "mes", "cliente", "produto", "pagamento"].includes(params.group ?? "") ? params.group! : "mes";
      const keyExpr: Record<string, string> = {
        dia: "to_char(s.issue_date, 'YYYY-MM-DD')",
        mes: "to_char(s.issue_date, 'YYYY-MM')",
        cliente: "coalesce(p.name, 'Sem cliente (balcão)')",
        produto: "i.description",
        pagamento: "coalesce(nullif(s.payment_method, ''), 'Não informado')",
      };
      const rows = await q<{ label: string; vendas: number; qty: number; total: number; custo: number }>(
        tenant,
        group === "produto"
          ? `select i.description as label, count(distinct s.id)::int as vendas, sum(i.qty)::float8 as qty, sum(i.total)::float8 as total, sum(i.qty * i.unit_cost)::float8 as custo
               from erp_sale_items i join erp_sales s on s.id = i.sale_id
              where s.tenant = $1 and s.status = 'confirmed' and s.issue_date between $2 and $3
              group by i.description order by total desc`
            : `select ${keyExpr[group]} as label, count(*)::int as vendas, 0::float8 as qty, sum(s.total)::float8 as total,
                      coalesce(sum((select sum(i.qty * i.unit_cost) from erp_sale_items i where i.sale_id = s.id)), 0)::float8 as custo
                 from erp_sales s left join erp_parties p on p.id = s.customer_id
                where s.tenant = $1 and s.status = 'confirmed' and s.issue_date between $2 and $3
                group by 1 order by ${group === "dia" || group === "mes" ? "1" : "total desc"}`,
        [from, to]
      );
      const total = rows.reduce((s, r) => s + r.total, 0);
      const cost = rows.reduce((s, r) => s + r.custo, 0);
      const count = rows.reduce((s, r) => s + r.vendas, 0);
      return {
        name,
        title: `Vendas por ${{ dia: "dia", mes: "mês", cliente: "cliente", produto: "produto", pagamento: "forma de pagamento" }[group]}`,
        description: `Vendas confirmadas de ${label}. Orçamentos e vendas canceladas não entram.`,
        columns: [
          { key: "label", label: { dia: "Dia", mes: "Mês", cliente: "Cliente", produto: "Produto", pagamento: "Pagamento" }[group] as string },
          { key: "vendas", label: "Vendas", type: "int", align: "right" },
          ...(group === "produto" ? [{ key: "qty", label: "Quantidade", type: "qty" as const, align: "right" as const }] : []),
          { key: "total", label: "Faturamento", type: "money", align: "right" },
          { key: "share", label: "% do total", type: "percent", align: "right" },
        ],
        rows: rows.map((r) => ({ ...r, share: pctOf(r.total, total) })),
        totals: { label: "Total", vendas: count, total, share: total ? 100 : 0 },
        note: cost > 0 ? `Custo das mercadorias vendidas: R$ ${cost.toFixed(2)}. Para ver a margem, abra "Margem por produto".` : undefined,
      };
    }

    case "margem": {
      const rows = await q<{ label: string; qty: number; receita: number; custo: number }>(
        tenant,
        `select i.description as label, sum(i.qty)::float8 as qty, sum(i.total)::float8 as receita, sum(i.qty * i.unit_cost)::float8 as custo
           from erp_sale_items i join erp_sales s on s.id = i.sale_id
          where s.tenant = $1 and s.status = 'confirmed' and s.issue_date between $2 and $3
          group by i.description order by sum(i.total) - sum(i.qty * i.unit_cost) desc`,
        [from, to]
      );
      const receita = rows.reduce((s, r) => s + r.receita, 0);
      const custo = rows.reduce((s, r) => s + r.custo, 0);
      return {
        name,
        title: "Margem por produto",
        description: `Lucro bruto (venda menos custo) de ${label}. Serviços sem custo cadastrado aparecem com 100% de margem.`,
        columns: [
          { key: "label", label: "Produto ou serviço" },
          { key: "qty", label: "Quantidade", type: "qty", align: "right" },
          { key: "receita", label: "Faturamento", type: "money", align: "right" },
          { key: "custo", label: "Custo", type: "money", align: "right" },
          { key: "lucro", label: "Lucro bruto", type: "money", align: "right" },
          { key: "margem", label: "Margem", type: "percent", align: "right" },
        ],
        rows: rows.map((r) => ({ ...r, lucro: r.receita - r.custo, margem: pctOf(r.receita - r.custo, r.receita) })),
        totals: { label: "Total", receita, custo, lucro: receita - custo, margem: pctOf(receita - custo, receita) },
      };
    }

    case "curva-abc": {
      const rows = await q<{ label: string; qty: number; total: number }>(
        tenant,
        `select i.description as label, sum(i.qty)::float8 as qty, sum(i.total)::float8 as total
           from erp_sale_items i join erp_sales s on s.id = i.sale_id
          where s.tenant = $1 and s.status = 'confirmed' and s.issue_date between $2 and $3
          group by i.description order by total desc`,
        [from, to]
      );
      const total = rows.reduce((s, r) => s + r.total, 0);
      let acc = 0;
      return {
        name,
        title: "Curva ABC de produtos",
        description: `Classe A: os que somam até 80% do faturamento; B: até 95%; C: o resto. Período: ${label}.`,
        columns: [
          { key: "label", label: "Produto ou serviço" },
          { key: "qty", label: "Quantidade", type: "qty", align: "right" },
          { key: "total", label: "Faturamento", type: "money", align: "right" },
          { key: "share", label: "% do total", type: "percent", align: "right" },
          { key: "acc", label: "% acumulado", type: "percent", align: "right" },
          { key: "classe", label: "Classe" },
        ],
        rows: rows.map((r) => {
          const before = pctOf(acc, total);
          acc += r.total;
          const accPct = pctOf(acc, total);
          return { ...r, share: pctOf(r.total, total), acc: accPct, classe: before < 80 ? "A" : before < 95 ? "B" : "C" };
        }),
        totals: { label: "Total", total, share: total ? 100 : 0 },
      };
    }

    case "clientes": {
      const rows = await q<{ label: string; vendas: number; total: number; ultima: string | null; dias: number | null }>(
        tenant,
        `select p.name as label, count(s.id)::int as vendas, coalesce(sum(s.total), 0)::float8 as total,
                max(s.issue_date)::text as ultima, (erp_today() - max(s.issue_date))::int as dias
           from erp_parties p
           left join erp_sales s on s.customer_id = p.id and s.tenant = p.tenant and s.status = 'confirmed' and s.issue_date between $2 and $3
          where p.tenant = $1 and p.is_customer and p.status <> 'inactive'
          group by p.id, p.name order by total desc, p.name`,
        [from, to]
      );
      const total = rows.reduce((s, r) => s + r.total, 0);
      return {
        name,
        title: "Ranking de clientes",
        description: `Faturamento por cliente em ${label}. Quem aparece sem compras no período pode merecer um contato.`,
        columns: [
          { key: "label", label: "Cliente" },
          { key: "vendas", label: "Vendas", type: "int", align: "right" },
          { key: "total", label: "Faturamento", type: "money", align: "right" },
          { key: "ticket", label: "Ticket médio", type: "money", align: "right" },
          { key: "ultima", label: "Última compra", type: "date" },
          { key: "dias", label: "Dias sem comprar", type: "int", align: "right" },
        ],
        rows: rows.map((r) => ({ ...r, ticket: r.vendas ? r.total / r.vendas : 0 })),
        totals: { label: "Total", vendas: rows.reduce((s, r) => s + r.vendas, 0), total },
      };
    }

    case "dre": {
      const [rev] = await q<{ receita: number; custo: number; descontos: number }>(
        tenant,
        `select coalesce(sum(s.total), 0)::float8 as receita,
                coalesce(sum((select sum(i.qty * i.unit_cost) from erp_sale_items i where i.sale_id = s.id)), 0)::float8 as custo,
                coalesce(sum(s.discount), 0)::float8 as descontos
           from erp_sales s where s.tenant = $1 and s.status = 'confirmed' and s.issue_date between $2 and $3`,
        [from, to]
      );
      const other = await q<{ label: string; total: number }>(
        tenant,
        `select coalesce(c.name, 'Sem categoria') as label, sum(t.amount)::float8 as total
           from erp_titles t left join erp_categories c on c.id = t.category_id
          where t.tenant = $1 and t.direction = 'in' and t.origin_type <> 'sale' and t.status <> 'canceled' and t.due_date between $2 and $3
          group by 1 order by total desc`,
        [from, to]
      );
      const expenses = await q<{ label: string; total: number }>(
        tenant,
        `select coalesce(c.name, 'Sem categoria') as label, sum(t.amount)::float8 as total
           from erp_titles t left join erp_categories c on c.id = t.category_id
          where t.tenant = $1 and t.direction = 'out' and t.origin_type <> 'purchase' and t.status <> 'canceled' and t.due_date between $2 and $3
          group by 1 order by total desc`,
        [from, to]
      );
      const outras = other.reduce((s, r) => s + r.total, 0);
      const despesas = expenses.reduce((s, r) => s + r.total, 0);
      const bruto = rev.receita - rev.custo;
      const resultado = bruto + outras - despesas;
      const rows: Report["rows"] = [
        { linha: "Receita de vendas", valor: rev.receita, nivel: "total" },
        { linha: "(−) Custo das mercadorias vendidas", valor: -rev.custo, nivel: "item" },
        { linha: "= Lucro bruto", valor: bruto, nivel: "total" },
        ...other.map((r) => ({ linha: `(+) ${r.label}`, valor: r.total, nivel: "item" })),
        ...expenses.map((r) => ({ linha: `(−) ${r.label}`, valor: -r.total, nivel: "item" })),
        { linha: "= Resultado do período", valor: resultado, nivel: "total" },
      ];
      return {
        name,
        title: "Resultado do período (DRE)",
        description: `Visão por competência de ${label}: vendas pela data da venda, outras receitas e despesas pela data de vencimento.`,
        columns: [
          { key: "linha", label: "Linha" },
          { key: "valor", label: "Valor", type: "money", align: "right" },
        ],
        rows,
        note: `Margem bruta: ${pctOf(bruto, rev.receita)}% · Margem líquida: ${pctOf(resultado, rev.receita)}%. Compras de mercadoria entram pelo custo das vendas, não como despesa.`,
      };
    }

    case "caixa": {
      const rows = await q<{ label: string; entradas: number; saidas: number }>(
        tenant,
        `select coalesce(c.name, 'Sem categoria') as label,
                coalesce(sum(t.paid_amount) filter (where t.direction = 'in'), 0)::float8 as entradas,
                coalesce(sum(t.paid_amount) filter (where t.direction = 'out'), 0)::float8 as saidas
           from erp_titles t left join erp_categories c on c.id = t.category_id
          where t.tenant = $1 and t.status = 'paid' and t.paid_at between $2 and $3
          group by 1 order by sum(t.paid_amount) desc`,
        [from, to]
      );
      const entradas = rows.reduce((s, r) => s + r.entradas, 0);
      const saidas = rows.reduce((s, r) => s + r.saidas, 0);
      return {
        name,
        title: "Entradas e saídas realizadas",
        description: `Só o que foi recebido ou pago de verdade (baixado) entre ${label}.`,
        columns: [
          { key: "label", label: "Categoria" },
          { key: "entradas", label: "Entradas", type: "money", align: "right" },
          { key: "saidas", label: "Saídas", type: "money", align: "right" },
          { key: "saldo", label: "Saldo", type: "money", align: "right" },
        ],
        rows: rows.map((r) => ({ ...r, saldo: r.entradas - r.saidas })),
        totals: { label: "Total", entradas, saidas, saldo: entradas - saidas },
      };
    }

    case "inadimplencia": {
      const rows = await q<{ label: string; doc: string; titulos: number; total: number; atraso: number; b1: number; b2: number; b3: number; b4: number }>(
        tenant,
        `select coalesce(p.name, 'Sem cliente') as label, '' as doc, count(*)::int as titulos, sum(t.amount)::float8 as total,
                max(erp_today() - t.due_date)::int as atraso,
                coalesce(sum(t.amount) filter (where erp_today() - t.due_date between 1 and 30), 0)::float8 as b1,
                coalesce(sum(t.amount) filter (where erp_today() - t.due_date between 31 and 60), 0)::float8 as b2,
                coalesce(sum(t.amount) filter (where erp_today() - t.due_date between 61 and 90), 0)::float8 as b3,
                coalesce(sum(t.amount) filter (where erp_today() - t.due_date > 90), 0)::float8 as b4
           from erp_titles t left join erp_parties p on p.id = t.party_id
          where t.tenant = $1 and t.direction = 'in' and t.status = 'open' and t.due_date < erp_today()
          group by p.id, p.name order by total desc`
      );
      const sum = (k: "total" | "b1" | "b2" | "b3" | "b4" | "titulos") => rows.reduce((s, r) => s + r[k], 0);
      return {
        name,
        title: "Contas em atraso",
        description: "Valores a receber que já venceram e continuam em aberto, hoje.",
        columns: [
          { key: "label", label: "Cliente" },
          { key: "titulos", label: "Parcelas", type: "int", align: "right" },
          { key: "b1", label: "1 a 30 dias", type: "money", align: "right" },
          { key: "b2", label: "31 a 60", type: "money", align: "right" },
          { key: "b3", label: "61 a 90", type: "money", align: "right" },
          { key: "b4", label: "Mais de 90", type: "money", align: "right" },
          { key: "total", label: "Total", type: "money", align: "right" },
          { key: "atraso", label: "Maior atraso (dias)", type: "int", align: "right" },
        ],
        rows,
        totals: { label: "Total", titulos: sum("titulos"), b1: sum("b1"), b2: sum("b2"), b3: sum("b3"), b4: sum("b4"), total: sum("total") },
      };
    }

    case "estoque": {
      const rows = await q<{ label: string; sku: string; unit: string; saldo: number; minimo: number; custo: number; valor: number; situacao: string }>(
        tenant,
        `select * from (
           select p.name as label, p.sku, p.unit,
                  coalesce((select sum(m.qty) from erp_stock_moves m where m.tenant = p.tenant and m.product_id = p.id), 0)::float8 as saldo,
                  p.min_stock::float8 as minimo, p.cost_price::float8 as custo
             from erp_products p where p.tenant = $1 and p.active and p.track_stock
         ) x,
         lateral (select greatest(x.saldo, 0) * x.custo as valor,
                         case when x.saldo <= 0 then 'Zerado' when x.saldo <= x.minimo then 'Baixo' else 'OK' end as situacao) y
         order by valor desc`
      );
      return {
        name,
        title: "Posição de estoque",
        description: "Saldo atual de cada produto que controla estoque, avaliado pelo custo atual.",
        columns: [
          { key: "label", label: "Produto" },
          { key: "sku", label: "Código" },
          { key: "saldo", label: "Saldo", type: "qty", align: "right" },
          { key: "unit", label: "Un." },
          { key: "minimo", label: "Mínimo", type: "qty", align: "right" },
          { key: "custo", label: "Custo", type: "money", align: "right" },
          { key: "valor", label: "Valor em estoque", type: "money", align: "right" },
          { key: "situacao", label: "Situação" },
        ],
        rows,
        totals: { label: "Total", valor: rows.reduce((s, r) => s + r.valor, 0) },
      };
    }
  }
  throw new HttpError(404, "Relatório não encontrado.");
}
