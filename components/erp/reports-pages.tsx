"use client";

import { useState } from "react";
import Link from "next/link";
import { AlarmClock, ArrowLeft, BarChart3, Boxes, Download, Percent, Printer, Scale, ShoppingCart, Users, Wallet } from "lucide-react";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { qs, useApi } from "@/lib/erp/client";
import type { Report, ReportColumn } from "@/lib/erp/types";
import { addDaysIso, fmtDate, money, monthStartIso, qtyFmt, todayIso } from "@/lib/erp/format";
import { REPORTS } from "@/lib/erp/report-list";
import { Chips, DateField, EmptyState, ErrorNote, Field, LoadingRows, PageHeader, SelectField, Tag } from "@/components/erp/ui";
import { RankBars } from "@/components/erp/charts";
import { ErpGate } from "@/components/erp/gate";

const ICONS = { ShoppingCart, Percent, BarChart3, Users, Scale, Wallet, AlarmClock, Boxes } as const;

export function ReportsIndexPage() {
  return (
    <ErpGate>
      {() => (
        <>
          <PageHeader
            title="Relatórios"
            description="Respostas prontas para as perguntas de quem toca o negócio: quanto vendi, quanto sobrou, quem está devendo."
            help={<p>Escolha um relatório, ajuste o período e, se quiser, baixe a planilha (CSV) ou imprima. Todos usam os dados que você já registrou no sistema.</p>}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {REPORTS.map((r) => {
              const Icon = ICONS[r.icon as keyof typeof ICONS];
              return (
                <Link key={r.name} href={`/relatorios/${r.name}`} className="group rounded-3xl border bg-card p-5 transition-colors hover:border-primary/60">
                  <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/20"><Icon size={20} /></span>
                  <p className="text-base font-semibold group-hover:underline">{r.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </ErpGate>
  );
}

type Preset = "month" | "prev" | "90" | "year" | "custom";

function presetRange(p: Preset): { from: string; to: string } {
  const today = todayIso();
  if (p === "month") return { from: monthStartIso(today), to: today };
  if (p === "prev") {
    const last = addDaysIso(monthStartIso(today), -1);
    return { from: monthStartIso(last), to: last };
  }
  if (p === "90") return { from: addDaysIso(today, -90), to: today };
  return { from: `${today.slice(0, 4)}-01-01`, to: today };
}

const NO_PERIOD = new Set(["inadimplencia", "estoque"]);

function cell(value: string | number | null | undefined, col: ReportColumn): React.ReactNode {
  if (value === null || value === undefined || value === "") return "—";
  switch (col.type) {
    case "money":
      return money(Number(value));
    case "qty":
      return qtyFmt(Number(value));
    case "percent":
      return `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
    case "date":
      return fmtDate(String(value));
    case "int":
      return Number(value).toLocaleString("pt-BR");
    default:
      return String(value);
  }
}

function toCsv(report: Report): string {
  const esc = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = report.columns.map((c) => esc(c.label)).join(";");
  const fmt = (v: string | number | null | undefined, c: ReportColumn) => (typeof v === "number" && c.type !== "int" ? String(v).replace(".", ",") : v);
  const lines = report.rows.map((r) => report.columns.map((c) => esc(fmt(r[c.key], c))).join(";"));
  if (report.totals) lines.push(report.columns.map((c) => esc(fmt(report.totals?.[c.key], c))).join(";"));
  return "﻿" + [head, ...lines].join("\r\n");
}

export function ReportViewPage({ name }: { name: string }) {
  return <ErpGate>{() => <View name={name} />}</ErpGate>;
}

function View({ name }: { name: string }) {
  const meta = REPORTS.find((r) => r.name === name);
  const [preset, setPreset] = useState<Preset>("month");
  const [custom, setCustom] = useState(() => presetRange("month"));
  const [group, setGroup] = useState("mes");
  const range = preset === "custom" ? custom : presetRange(preset);
  const usesPeriod = !NO_PERIOD.has(name);
  const { data, error, loading, reload } = useApi<Report>(meta ? `/api/erp/reports/${name}${qs({ ...(usesPeriod ? range : {}), group: name === "vendas" ? group : undefined })}` : null);

  if (!meta) return <ErrorNote message="Relatório não encontrado." />;

  const chartCol = data?.columns.find((c) => c.type === "money" && !["custo", "saldo", "lucro"].includes(c.key)) ?? data?.columns.find((c) => c.type === "money");
  const chartRows = data && chartCol && !["dre", "caixa", "estoque"].includes(name) && group !== "mes" && group !== "dia"
    ? data.rows.slice(0, 8).map((r) => ({ label: String(r[data.columns[0].key] ?? ""), value: Number(r[chartCol.key]) || 0 })).filter((r) => r.value > 0)
    : [];

  function download() {
    if (!data) return;
    const blob = new Blob([toCsv(data)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}-${range.from}-a-${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Link href="/relatorios" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground print:hidden"><ArrowLeft size={15} /> Relatórios</Link>
      <PageHeader
        title={data?.title ?? meta.title}
        description={data?.description ?? meta.description}
        actions={
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" className="rounded-full" disabled={!data || data.rows.length === 0} onClick={download}><Download size={15} /> Baixar planilha</Button>
            <Button variant="outline" className="rounded-full" onClick={() => window.print()}><Printer size={15} /> Imprimir</Button>
          </div>
        }
      />
      {usesPeriod && (
        <Panel className="mb-4 print:hidden">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="mb-1.5 text-sm font-medium">Período</p>
              <Chips label="Período" value={preset} onChange={(p) => { setPreset(p); if (p !== "custom") setCustom(presetRange(p)); }} options={[{ value: "month", label: "Este mês" }, { value: "prev", label: "Mês passado" }, { value: "90", label: "90 dias" }, { value: "year", label: "Este ano" }, { value: "custom", label: "Escolher datas" }]} />
            </div>
            {preset === "custom" && (
              <div className="flex items-end gap-3">
                <Field label="De"><DateField value={custom.from} onChange={(v) => setCustom((c) => ({ ...c, from: v }))} /></Field>
                <Field label="Até"><DateField value={custom.to} onChange={(v) => setCustom((c) => ({ ...c, to: v }))} /></Field>
              </div>
            )}
            {name === "vendas" && (
              <Field label="Agrupar por" className="w-48">
                <SelectField value={group} onChange={setGroup} options={[{ value: "mes", label: "Mês" }, { value: "dia", label: "Dia" }, { value: "cliente", label: "Cliente" }, { value: "produto", label: "Produto" }, { value: "pagamento", label: "Forma de pagamento" }]} />
              </Field>
            )}
          </div>
        </Panel>
      )}
      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data ? (
        <LoadingRows rows={6} />
      ) : data ? (
        <div className="grid grid-cols-1 gap-4">
          {chartRows.length > 1 && (
            <Panel className="print:hidden">
              <h2 className="mb-3 text-base font-semibold">Maiores — {chartCol?.label}</h2>
              <RankBars rows={chartRows} />
            </Panel>
          )}
          <Panel>
            {data.rows.length === 0 ? (
              <EmptyState icon={BarChart3} title="Sem dados neste período">Registre vendas, compras e lançamentos, ou mude o período acima.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      {data.columns.map((c) => <th key={c.key} className={`px-3 py-2.5 font-medium ${c.align === "right" ? "text-right" : "text-left"}`}>{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.rows.map((r, i) => {
                      const strong = r.nivel === "total";
                      return (
                        <tr key={i} className={strong ? "bg-muted/50 font-semibold" : undefined}>
                          {data.columns.map((c) => {
                            const v = r[c.key];
                            return (
                              <td key={c.key} className={`px-3 py-2.5 ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.type === "money" && Number(v) < 0 && name === "dre" ? "text-bad" : ""}`}>
                                {c.key === "classe" ? <Tag tone={v === "A" ? "good" : v === "B" ? "warn" : "neutral"}>{String(v)}</Tag> : c.key === "situacao" ? <Tag tone={v === "OK" ? "good" : v === "Baixo" ? "warn" : "bad"}>{String(v)}</Tag> : cell(v, c)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                  {data.totals && (
                    <tfoot>
                      <tr className="border-t-2 font-bold">
                        {data.columns.map((c) => <td key={c.key} className={`px-3 py-3 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>{data.totals?.[c.key] === undefined ? "" : cell(data.totals[c.key], c)}</td>)}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
            {data.note && <p className="mt-4 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">{data.note}</p>}
          </Panel>
        </div>
      ) : null}
    </>
  );
}
