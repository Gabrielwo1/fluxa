"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarClock, ExternalLink, FileCheck, FileDown, FileText, FileUp, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { call, qs, useApi } from "@/lib/erp/client";
import type { Invoice, InvoiceSummary } from "@/lib/erp/types";
import { fmtDate, money } from "@/lib/erp/format";
import { DAS_DUE_DAY, EMISSOR_NACIONAL_URL, MEI_PORTAL_URL } from "@/lib/erp/mei";
import { formatDocument } from "@/lib/erp/validators";
import { ConfirmDialog, EmptyState, ErrorNote, Kpi, LoadingRows, PageHeader, SearchBox, Tag, useDebounced } from "@/components/erp/ui";
import { DataTable, type Column } from "@/components/erp/data-table";
import { InvoiceGuide } from "@/components/erp/invoice-guide";
import { ErpGate } from "@/components/erp/gate";

export function InvoicesPage() {
  return <ErpGate>{(st) => <Inner canWrite={st.canWrite} />}</ErpGate>;
}

function Inner({ canWrite }: { canWrite: boolean }) {
  const [q, setQ] = useState("");
  const debounced = useDebounced(q);
  const { data, error, loading, reload } = useApi<{ invoices: Invoice[]; summary: InvoiceSummary }>(`/api/erp/invoices${qs({ q: debounced })}`);
  const [guide, setGuide] = useState<{ saleId: string | null } | null>(null);
  const [removing, setRemoving] = useState<Invoice | null>(null);
  const bulk = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const s = data?.summary;
  const invoices = useMemo(() => data?.invoices ?? [], [data]);
  const usedPct = s ? Math.min(100, (s.issued_year / s.limit) * 100) : 0;
  const salesPct = s ? (s.sales_year / s.limit) * 100 : 0;
  const [today] = useState(() => new Date());
  const dasDays = (() => {
    const due = new Date(today.getFullYear(), today.getMonth() + (today.getDate() > DAS_DUE_DAY ? 1 : 0), DAS_DUE_DAY);
    return Math.ceil((due.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);
  })();

  async function sendMany(files: FileList) {
    setBusy(true);
    let ok = 0;
    const errors: string[] = [];
    for (const f of Array.from(files)) {
      try {
        await call("POST", "/api/erp/invoices", { xml: await f.text() });
        ok++;
      } catch (e) {
        errors.push(`${f.name}: ${(e as Error).message}`);
      }
    }
    setBusy(false);
    if (bulk.current) bulk.current.value = "";
    if (ok) toast.success(`${ok} nota(s) registrada(s).`);
    if (errors.length) toast.error(errors[0] + (errors.length > 1 ? ` (+${errors.length - 1} com problema)` : ""));
    reload();
  }

  const columns: Column<Invoice>[] = [
    { key: "n", header: "Nº", cell: (i) => <span className="font-semibold">{i.number}</span> },
    { key: "date", header: "Emissão", cell: (i) => fmtDate(i.issue_date) },
    { key: "c", header: "Cliente", cell: (i) => <div className="min-w-0"><p className="truncate font-medium">{i.customer_name || "—"}</p><p className="text-xs text-muted-foreground">{i.customer_document ? formatDocument(i.customer_document) : ""}</p></div> },
    { key: "sale", header: "Venda", cell: (i) => (i.sale_number ? `#${i.sale_number}` : <span className="text-muted-foreground">sem venda</span>) },
    { key: "v", header: "Valor", align: "right", cell: (i) => <span className="font-semibold">{money(i.amount)}</span> },
    { key: "st", header: "", cell: (i) => (i.status === "canceled" ? <Tag tone="bad">Cancelada</Tag> : <Tag tone="good">Emitida</Tag>) },
    { key: "act", header: "", align: "right", cell: (i) => <RowActions i={i} canWrite={canWrite} onRemove={() => setRemoving(i)} onChanged={reload} /> },
  ];

  return (
    <>
      <PageHeader
        title="Notas fiscais (MEI)"
        description="Você emite no portal do governo, com a sua conta gov.br, e o Fluxa guarda as notas, liga cada uma à venda e vigia o limite do MEI."
        help={
          <>
            <p>O sistema <strong>não pede a senha do gov.br</strong> e não emite por você: a emissão acontece no Emissor Nacional, em nome do seu CNPJ.</p>
            <p>Depois de emitir, envie o <strong>XML</strong> que o portal gera. O Fluxa lê número, valor e cliente sozinho e liga à venda.</p>
            <p>Em geral, o MEI precisa emitir nota quando vende para <strong>empresa (CNPJ)</strong>; para pessoa física só se o cliente pedir. Confirme as regras do seu caso com o contador.</p>
          </>
        }
        actions={
          canWrite ? (
            <>
              <input ref={bulk} type="file" accept=".xml,text/xml,application/xml" multiple className="hidden" onChange={(e) => e.target.files?.length && void sendMany(e.target.files)} />
              <Button variant="outline" className="rounded-full" disabled={busy} onClick={() => bulk.current?.click()}><FileUp size={16} /> Enviar XMLs</Button>
              <Button className="rounded-full font-semibold" onClick={() => setGuide({ saleId: null })}><Plus size={16} /> Registrar nota</Button>
            </>
          ) : undefined
        }
      />
      {error && <ErrorNote message={error} onRetry={reload} />}

      {s && (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Panel>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold">Limite anual do MEI</h2>
                <span className="text-sm tabular-nums text-muted-foreground">{money(s.issued_year)} de {money(s.limit)} em notas de {s.year}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${usedPct >= 90 ? "bg-bad" : usedPct >= 70 ? "bg-[var(--c-fixed)]" : "bg-primary"}`} style={{ width: `${usedPct}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {usedPct >= 90 ? "Atenção: você está perto do teto do MEI. Fale com o contador sobre o desenquadramento." : `Falta ${money(Math.max(0, s.limit - s.issued_year))} para o teto.`}
                {s.sales_year > s.issued_year && ` As vendas do ano somam ${money(s.sales_year)} (${salesPct.toFixed(0)}% do teto), incluindo o que ainda não tem nota.`}
              </p>
            </Panel>
            <Panel>
              <h2 className="mb-1 flex items-center gap-2 text-base font-semibold"><CalendarClock size={16} /> DAS do mês</h2>
              <p className="text-sm text-muted-foreground">Vence todo dia {DAS_DUE_DAY}. {dasDays === 0 ? "Vence hoje!" : `Faltam ${dasDays} dia(s).`}</p>
              <Button variant="outline" className="mt-3 rounded-full" render={<a href={MEI_PORTAL_URL} target="_blank" rel="noreferrer" />}><ExternalLink size={14} /> Gerar o DAS no gov.br</Button>
            </Panel>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label={`Notas em ${s.year}`} value={String(s.issued_count)} />
            <Kpi label="Valor emitido no ano" value={money(s.issued_year)} />
            <Kpi label="Vendas sem nota" value={String(s.pending_sales.length)} tone={s.pending_sales.length ? "warn" : undefined} hint="Vendas confirmadas que ainda não têm nota ligada." />
            <Kpi label="Para empresas (CNPJ)" value={String(s.pending_sales.filter((p) => p.has_company_customer).length)} sub="sem nota, em geral obrigatória" tone={s.pending_sales.some((p) => p.has_company_customer) ? "bad" : undefined} />
          </div>

          {s.pending_sales.length > 0 && canWrite && (
            <Panel className="mb-4">
              <h2 className="mb-1 text-base font-semibold">Vendas esperando nota</h2>
              <p className="mb-3 text-xs text-muted-foreground">Vendas para empresas aparecem primeiro, porque costumam exigir nota.</p>
              <ul className="divide-y">
                {s.pending_sales.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">#{p.number} · {p.customer_name ?? "Balcão"} {p.has_company_customer && <Tag tone="warn">CNPJ</Tag>}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(p.issue_date)} · {money(p.total)}</p>
                    </div>
                    <Button size="sm" className="rounded-full" onClick={() => setGuide({ saleId: p.id })}>Emitir nota</Button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}

      <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SearchBox value={q} onChange={setQ} placeholder="Buscar por cliente, número ou CNPJ…" className="w-full sm:max-w-sm sm:flex-1" />
          <Button variant="ghost" className="rounded-full" render={<a href={EMISSOR_NACIONAL_URL} target="_blank" rel="noreferrer" />}><ExternalLink size={14} /> Abrir o Emissor Nacional</Button>
        </div>
        {loading && !data ? (
          <LoadingRows />
        ) : invoices.length === 0 ? (
          <EmptyState icon={FileCheck} title="Nenhuma nota registrada ainda" action={canWrite ? <Button className="rounded-full font-semibold" onClick={() => setGuide({ saleId: null })}><Plus size={16} /> Registrar a primeira</Button> : undefined}>
            Emita no portal do governo e traga o XML para cá. Ou, numa venda confirmada, use o botão “Emitir nota”.
          </EmptyState>
        ) : (
          <DataTable
            rows={invoices}
            rowKey={(i) => i.id}
            columns={columns}
            mobileCard={(i) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">Nota {i.number} · {i.customer_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(i.issue_date)}{i.sale_number ? ` · venda #${i.sale_number}` : ""}</p>
                  <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {i.status === "canceled" ? <Tag tone="bad">Cancelada</Tag> : <Tag tone="good">Emitida</Tag>}
                    <RowActions i={i} canWrite={canWrite} onRemove={() => setRemoving(i)} onChanged={reload} />
                  </div>
                </div>
                <span className="font-semibold tabular-nums">{money(i.amount)}</span>
              </div>
            )}
          />
        )}
      </Panel>

      <InvoiceGuide open={Boolean(guide)} onOpenChange={(o) => !o && setGuide(null)} saleId={guide?.saleId} onDone={reload} />
      <ConfirmDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)} title="Remover esta nota do sistema?" danger confirmLabel="Remover" onConfirm={async () => { if (removing) { try { await call("DELETE", `/api/erp/invoices/${removing.id}`); toast.success("Nota removida do sistema."); reload(); } catch (e) { toast.error((e as Error).message); } } setRemoving(null); }}>
        Isso só tira o registro daqui. A nota continua valendo no portal do governo; para cancelá-la, use o próprio Emissor Nacional e depois marque como cancelada.
      </ConfirmDialog>
    </>
  );
}

function RowActions({ i, canWrite, onRemove, onChanged }: { i: Invoice; canWrite: boolean; onRemove: () => void; onChanged: () => void }) {
  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {i.has_xml && (
        <Button size="sm" variant="outline" className="rounded-full" render={<a href={`/api/erp/invoices/${i.id}/pdf`} target="_blank" rel="noreferrer" />}><FileText size={14} /> PDF</Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Mais ações" className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"><MoreHorizontal size={16} /></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {i.has_xml && <DropdownMenuItem onClick={() => window.open(`/api/erp/invoices/${i.id}/xml`, "_blank")}><FileDown size={14} /> Baixar XML</DropdownMenuItem>}
          {canWrite && i.status === "issued" && <DropdownMenuItem onClick={() => act(() => call("PUT", `/api/erp/invoices/${i.id}`, { status: "canceled" }), "Nota marcada como cancelada.")}>Marcar como cancelada</DropdownMenuItem>}
          {canWrite && i.status === "canceled" && <DropdownMenuItem onClick={() => act(() => call("PUT", `/api/erp/invoices/${i.id}`, { status: "issued" }), "Nota reativada.")}>Marcar como emitida</DropdownMenuItem>}
          {canWrite && i.sale_id && <DropdownMenuItem onClick={() => act(() => call("PUT", `/api/erp/invoices/${i.id}`, { sale_id: null }), "Nota desligada da venda.")}>Desligar da venda</DropdownMenuItem>}
          {canWrite && (<><DropdownMenuSeparator /><DropdownMenuItem onClick={onRemove} className="text-destructive">Remover do sistema</DropdownMenuItem></>)}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
