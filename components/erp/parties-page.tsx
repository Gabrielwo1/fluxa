"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MessageCircle, Pencil, Phone, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { call, qs, useApi } from "@/lib/erp/client";
import type { Party, Sale, Title } from "@/lib/erp/types";
import { fmtDate, money } from "@/lib/erp/format";
import { digits, formatDocument, formatPhone } from "@/lib/erp/validators";
import { Chips, ConfirmDialog, EmptyState, ErrorNote, Kpi, LoadingRows, PageHeader, SearchBox, Tag, useClearNew, useDebounced } from "@/components/erp/ui";
import { DataTable, type Column } from "@/components/erp/data-table";
import { PartyFormSheet } from "@/components/erp/party-form";
import { SaleStatusTag } from "@/components/erp/status";
import { ErpGate } from "@/components/erp/gate";

type Role = "customer" | "supplier";
type Filter = "all" | "active" | "lead" | "inactive";

const COPY = {
  customer: {
    title: "Clientes",
    plural: "clientes",
    singular: "cliente",
    description: "Quem compra de você. Guarde contato, histórico de vendas e o que está em aberto.",
    help: (
      <>
        <p>Cadastre cada pessoa ou empresa que compra de você. É daqui que saem as vendas, as cobranças e os relatórios por cliente.</p>
        <p>
          <strong>Lead</strong> é quem ainda está negociando e não comprou. Quando a primeira venda for confirmada, mude para <strong>Ativo</strong>.
        </p>
      </>
    ),
    emptyTitle: "Cadastre o primeiro cliente",
    emptyText: "Com o cliente cadastrado você registra vendas, controla o que ele deve e vê quanto ele já comprou.",
  },
  supplier: {
    title: "Fornecedores",
    plural: "fornecedores",
    singular: "fornecedor",
    description: "De quem você compra. Registre as compras e acompanhe o que precisa pagar.",
    help: (
      <>
        <p>Cadastre as empresas e pessoas que vendem para você: mercadorias, aluguel, serviços.</p>
        <p>Ao registrar uma compra, o estoque sobe e a conta a pagar nasce sozinha com o nome do fornecedor.</p>
      </>
    ),
    emptyTitle: "Cadastre o primeiro fornecedor",
    emptyText: "Assim as compras ficam ligadas a quem vendeu e o contas a pagar mostra quanto você deve a cada um.",
  },
} as const;

const statusTag = (s: Party["status"]) =>
  s === "lead" ? <Tag tone="info">Lead</Tag> : s === "inactive" ? <Tag>Inativo</Tag> : <Tag tone="good">Ativo</Tag>;

export function PartiesPage({ role, novo = false }: { role: Role; novo?: boolean }) {
  return <ErpGate>{() => <Inner role={role} novo={novo} />}</ErpGate>;
}

function Inner({ role, novo }: { role: Role; novo: boolean }) {
  const copy = COPY[role];
  const clearNew = useClearNew(novo);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Party | null>(null);
  const [formOpen, setFormOpen] = useState(novo);
  const [viewing, setViewing] = useState<string | null>(null);
  const debounced = useDebounced(q);
  const { data, error, loading, reload } = useApi<{ parties: Party[] }>(`/api/erp/parties${qs({ kind: role, q: debounced, status: "all" })}`);

  const all = useMemo(() => data?.parties ?? [], [data]);
  const counts = useMemo(
    () => ({
      all: all.length,
      active: all.filter((p) => p.status === "active").length,
      lead: all.filter((p) => p.status === "lead").length,
      inactive: all.filter((p) => p.status === "inactive").length,
    }),
    [all]
  );
  const rows = filter === "all" ? all.filter((p) => p.status !== "inactive") : all.filter((p) => p.status === filter);
  const totalOpen = all.reduce((s, p) => s + (role === "customer" ? (p.open_receivable ?? 0) : (p.open_payable ?? 0)), 0);
  const totalLate = all.reduce((s, p) => s + (p.overdue_receivable ?? 0), 0);

  const columns: Column<Party>[] = [
    {
      key: "name",
      header: "Nome",
      cell: (p) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{p.name}</p>
          {p.trade_name && <p className="truncate text-xs text-muted-foreground">{p.trade_name}</p>}
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contato",
      cell: (p) => (
        <div className="text-xs text-muted-foreground">
          {p.phone && <p>{formatPhone(p.phone)}</p>}
          {p.email && <p className="truncate">{p.email}</p>}
          {!p.phone && !p.email && "—"}
        </div>
      ),
    },
    ...(role === "customer"
      ? ([
          { key: "total", header: "Já comprou", align: "right", cell: (p) => (p.sales_total ? money(p.sales_total) : "—") },
          { key: "last", header: "Última compra", cell: (p) => (p.last_sale ? fmtDate(p.last_sale) : "—") },
          {
            key: "open",
            header: "Em aberto",
            align: "right",
            cell: (p) =>
              p.overdue_receivable ? (
                <span className="font-semibold text-bad">{money(p.open_receivable)} (atrasado)</span>
              ) : p.open_receivable ? (
                money(p.open_receivable)
              ) : (
                "—"
              ),
          },
        ] as Column<Party>[])
      : ([{ key: "open", header: "A pagar", align: "right", cell: (p) => (p.open_payable ? money(p.open_payable) : "—") }] as Column<Party>[])),
    { key: "status", header: "Situação", cell: (p) => statusTag(p.status) },
  ];

  return (
    <>
      <PageHeader
        title={copy.title}
        description={copy.description}
        help={copy.help}
        actions={
          <Button
            className="rounded-full font-semibold"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={16} /> Novo {copy.singular}
          </Button>
        }
      />

      {error && <ErrorNote message={error} onRetry={reload} />}

      {all.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label={`Total de ${copy.plural}`} value={String(counts.all - counts.inactive)} sub={counts.inactive ? `${counts.inactive} inativo(s)` : undefined} />
          {role === "customer" ? <Kpi label="Leads em negociação" value={String(counts.lead)} /> : <Kpi label="Ativos" value={String(counts.active)} />}
          <Kpi label={role === "customer" ? "A receber deles" : "A pagar a eles"} value={money(totalOpen)} />
          {role === "customer" && <Kpi label="Em atraso" value={money(totalLate)} tone={totalLate > 0 ? "bad" : undefined} hint="Parcelas vencidas que ainda não foram recebidas." />}
        </div>
      )}

      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchBox value={q} onChange={setQ} placeholder={`Buscar por nome, CPF/CNPJ, telefone…`} className="w-full sm:max-w-sm sm:flex-1" />
          {role === "customer" && (
            <Chips
              label="Filtrar por situação"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "Todos" },
                { value: "active", label: "Ativos", count: counts.active },
                { value: "lead", label: "Leads", count: counts.lead },
                { value: "inactive", label: "Inativos", count: counts.inactive },
              ]}
            />
          )}
        </div>

        {loading && !data ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          q || filter !== "all" ? (
            <EmptyState icon={Users} title="Nada encontrado">
              Tente outra busca ou outro filtro.
            </EmptyState>
          ) : (
            <EmptyState
              icon={UserPlus}
              title={copy.emptyTitle}
              action={
                <Button className="rounded-full font-semibold" onClick={() => setFormOpen(true)}>
                  <Plus size={16} /> Cadastrar {copy.singular}
                </Button>
              }
            >
              {copy.emptyText}
            </EmptyState>
          )
        ) : (
          <DataTable
            rows={rows}
            rowKey={(p) => p.id}
            columns={columns}
            onRowClick={(p) => setViewing(p.id)}
            mobileCard={(p) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{[p.phone && formatPhone(p.phone), p.city].filter(Boolean).join(" · ") || "Sem contato"}</p>
                  {(p.open_receivable ?? 0) > 0 && role === "customer" && (
                    <p className={p.overdue_receivable ? "mt-1 text-xs font-semibold text-bad" : "mt-1 text-xs text-muted-foreground"}>
                      Em aberto: {money(p.open_receivable)}
                    </p>
                  )}
                </div>
                {statusTag(p.status)}
              </div>
            )}
          />
        )}
      </Panel>

      <PartyFormSheet
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) {
            setEditing(null);
            clearNew();
          }
        }}
        party={editing}
        role={role}
        onSaved={() => reload()}
      />
      <PartyDetail
        id={viewing}
        role={role}
        onClose={() => setViewing(null)}
        onEdit={(p) => {
          setViewing(null);
          setEditing(p);
          setFormOpen(true);
        }}
        onChanged={reload}
      />
    </>
  );
}

function PartyDetail({
  id,
  role,
  onClose,
  onEdit,
  onChanged,
}: {
  id: string | null;
  role: Role;
  onClose: () => void;
  onEdit: (p: Party) => void;
  onChanged: () => void;
}) {
  const { data, error } = useApi<{ party: Party; sales: Sale[]; titles: Title[] }>(id ? `/api/erp/parties/${id}` : null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const p = data?.party;
  const wa = p?.phone ? `https://wa.me/55${digits(p.phone)}` : null;
  const openTitles = (data?.titles ?? []).filter((t) => t.status === "open");

  async function remove() {
    if (!p) return;
    try {
      await call("DELETE", `/api/erp/parties/${p.id}`);
      toast.success("Cadastro excluído.");
      setConfirmDelete(false);
      onClose();
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
      setConfirmDelete(false);
    }
  }

  return (
    <>
      <Sheet open={Boolean(id)} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="border-b p-5 pr-14">
            <SheetTitle className="text-lg font-bold">{p?.name ?? "Carregando…"}</SheetTitle>
            {p && (
              <div className="flex flex-wrap items-center gap-2">
                {statusTag(p.status)}
                {p.is_customer && p.is_supplier && <Tag tone="neutral">Cliente e fornecedor</Tag>}
                {p.document && <span className="text-xs text-muted-foreground">{formatDocument(p.document)}</span>}
              </div>
            )}
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
            {error && <ErrorNote message={error} />}
            {!p ? (
              <LoadingRows rows={4} />
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="rounded-full" onClick={() => onEdit(p)}>
                    <Pencil size={15} /> Editar
                  </Button>
                  {wa && (
                    <Button variant="outline" className="rounded-full" render={<a href={wa} target="_blank" rel="noreferrer" />}>
                      <MessageCircle size={15} /> WhatsApp
                    </Button>
                  )}
                  {p.phone && (
                    <Button variant="outline" className="rounded-full" render={<a href={`tel:${digits(p.phone)}`} />}>
                      <Phone size={15} /> Ligar
                    </Button>
                  )}
                  {role === "customer" && (
                    <Button className="rounded-full font-semibold" render={<Link href={`/vendas/nova?cliente=${p.id}`} />}>
                      <Plus size={15} /> Nova venda
                    </Button>
                  )}
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {p.phone && <Info label="Telefone" value={formatPhone(p.phone)} />}
                  {p.email && <Info label="E-mail" value={p.email} />}
                  {(p.street || p.city) && (
                    <Info
                      label="Endereço"
                      value={[p.street && `${p.street}${p.number ? `, ${p.number}` : ""}`, p.complement, p.district, [p.city, p.state].filter(Boolean).join("/")].filter(Boolean).join(" · ")}
                      wide
                    />
                  )}
                  {p.notes && <Info label="Observações" value={p.notes} wide />}
                </dl>

                {role === "customer" && (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold">Últimas vendas</h3>
                    {data.sales.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Ainda não há vendas para este cliente.</p>
                    ) : (
                      <ul className="divide-y rounded-2xl border">
                        {data.sales.map((s) => (
                          <li key={s.id}>
                            <Link href={`/vendas/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/60">
                              <span>
                                <span className="block text-sm font-medium">Venda #{s.number}</span>
                                <span className="block text-xs text-muted-foreground">{fmtDate(s.issue_date)}</span>
                              </span>
                              <span className="flex items-center gap-3">
                                <SaleStatusTag status={s.status} />
                                <span className="text-sm font-semibold tabular-nums">{money(s.total)}</span>
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}

                <section>
                  <h3 className="mb-2 text-sm font-semibold">{role === "customer" ? "A receber" : "A pagar"} em aberto</h3>
                  {openTitles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nada em aberto.</p>
                  ) : (
                    <ul className="divide-y rounded-2xl border">
                      {openTitles.map((t) => (
                        <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{t.description}</span>
                            <span className={t.overdue ? "block text-xs font-semibold text-bad" : "block text-xs text-muted-foreground"}>
                              vence {fmtDate(t.due_date)}
                              {t.overdue ? " · atrasado" : ""}
                            </span>
                          </span>
                          <span className="text-sm font-semibold tabular-nums">{money(t.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <div className="border-t pt-4">
                  <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={15} /> Excluir cadastro
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir este cadastro?"
        danger
        confirmLabel="Excluir"
        onConfirm={remove}
      >
        Só dá para excluir quem nunca teve vendas, compras ou contas. Se já tem histórico, mude a situação para Inativo.
      </ConfirmDialog>
    </>
  );
}

function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{value}</dd>
    </div>
  );
}
