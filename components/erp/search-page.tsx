"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Package, Search, ShoppingCart, Users, HandCoins } from "lucide-react";
import { Panel } from "@/components/ui-kit";
import { qs, useApi } from "@/lib/erp/client";
import type { SearchResults } from "@/lib/erp/services/search";
import { fmtDate, money } from "@/lib/erp/format";
import { EmptyState, ErrorNote, LoadingRows, PageHeader } from "@/components/erp/ui";
import { ErpGate } from "@/components/erp/gate";

export function SearchPage() {
  return <ErpGate>{() => <Results />}</ErpGate>;
}

function Section({ title, Icon, children }: { title: string; Icon: typeof Users; children: React.ReactNode }) {
  return (
    <Panel>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Icon size={15} /> {title}</h2>
      <ul className="divide-y">{children}</ul>
    </Panel>
  );
}

const row = "flex items-center justify-between gap-3 py-2.5 text-sm hover:underline";

function Results() {
  const q = useSearchParams().get("q") ?? "";
  const { data, error, loading } = useApi<SearchResults>(q.trim().length >= 2 ? `/api/erp/search${qs({ q })}` : null);
  const total = data ? data.parties.length + data.products.length + data.sales.length + data.titles.length : 0;

  return (
    <>
      <PageHeader title="Busca" description={q ? `Resultados para “${q}”` : "Digite pelo menos 2 letras na barra do topo."} />
      {error && <ErrorNote message={error} />}
      {loading && !data ? (
        <LoadingRows />
      ) : !q || q.trim().length < 2 ? (
        <EmptyState icon={Search} title="O que você procura?">Busque por nome de cliente ou fornecedor, CPF/CNPJ, produto, código, número da venda ou descrição de uma conta.</EmptyState>
      ) : total === 0 ? (
        <EmptyState icon={Search} title="Nada encontrado">Tente outro termo ou confira a grafia.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data!.parties.length > 0 && (
            <Section title="Clientes e fornecedores" Icon={Users}>
              {data!.parties.map((p) => <li key={p.id}><Link href={p.kind === "Fornecedor" ? "/fornecedores" : "/clientes"} className={row}><span className="font-medium">{p.name}</span><span className="text-xs text-muted-foreground">{p.kind}</span></Link></li>)}
            </Section>
          )}
          {data!.products.length > 0 && (
            <Section title="Produtos e serviços" Icon={Package}>
              {data!.products.map((p) => <li key={p.id}><Link href="/produtos" className={row}><span className="font-medium">{p.name}</span><span className="tabular-nums text-muted-foreground">{money(p.sale_price)}</span></Link></li>)}
            </Section>
          )}
          {data!.sales.length > 0 && (
            <Section title="Vendas" Icon={ShoppingCart}>
              {data!.sales.map((s) => <li key={s.id}><Link href={`/vendas/${s.id}`} className={row}><span className="font-medium">#{s.number} · {s.customer ?? "Balcão"}</span><span className="tabular-nums text-muted-foreground">{money(s.total)}</span></Link></li>)}
            </Section>
          )}
          {data!.titles.length > 0 && (
            <Section title="Contas a pagar e receber" Icon={HandCoins}>
              {data!.titles.map((t) => <li key={t.id}><Link href={t.direction === "in" ? "/receber" : "/pagar"} className={row}><span className="min-w-0 truncate font-medium">{t.description}</span><span className="shrink-0 text-xs text-muted-foreground">{fmtDate(t.due_date)} · {money(t.amount)}</span></Link></li>)}
            </Section>
          )}
        </div>
      )}
    </>
  );
}
