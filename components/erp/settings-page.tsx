"use client";

import { useState } from "react";
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { call, useApi } from "@/lib/erp/client";
import type { Category, Company } from "@/lib/erp/types";
import { formatDocument, formatPhone, formatZip, isValidDocument, digits } from "@/lib/erp/validators";
import { ConfirmDialog, ErrorNote, Field, FormDialog, LoadingRows, PageHeader, TextInput, Toggle, Tag } from "@/components/erp/ui";
import { ErpGate } from "@/components/erp/gate";

export function SettingsPage() {
  return <ErpGate>{(st) => <Settings canWrite={st.canWrite} />}</ErpGate>;
}

function Settings({ canWrite }: { canWrite: boolean }) {
  const company = useApi<Company>("/api/erp/company");
  if (company.error) return <ErrorNote message={company.error} onRetry={company.reload} />;
  if (!company.data) return <LoadingRows rows={5} />;
  return (
    <>
      <PageHeader title="Configurações" description="Dados da empresa, regras de estoque, categorias do financeiro e dados de exemplo." />
      <div className="grid grid-cols-1 gap-4">
        <CompanyForm key={JSON.stringify(company.data)} company={company.data} canWrite={canWrite} onSaved={company.reload} />
        <Categories canWrite={canWrite} />
        <DemoCard has={company.data.has_demo} canWrite={canWrite} onChanged={company.reload} />
      </div>
    </>
  );
}

function CompanyForm({ company, canWrite, onSaved }: { company: Company; canWrite: boolean; onSaved: () => void }) {
  const [f, setF] = useState({ ...company, document: formatDocument(company.document), phone: formatPhone(company.phone), zip: formatZip(company.zip) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const d = digits(f.document);
  const docError = d.length > 0 && (d.length === 11 || d.length === 14) && !isValidDocument(d) ? "CPF ou CNPJ inválido." : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (docError) return setError(docError);
    setBusy(true);
    try {
      await call("PUT", "/api/erp/company", { ...f, document: d, phone: digits(f.phone), zip: digits(f.zip) });
      toast.success("Dados salvos.");
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <form onSubmit={save} className="space-y-4">
        <h2 className="text-base font-semibold">Dados da empresa</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nome da empresa"><TextInput value={f.name} onChange={(e) => set("name", e.target.value)} disabled={!canWrite} /></Field>
          <Field label="Nome fantasia"><TextInput value={f.trade_name} onChange={(e) => set("trade_name", e.target.value)} disabled={!canWrite} /></Field>
          <Field label="CNPJ ou CPF" error={docError}><TextInput value={f.document} onChange={(e) => set("document", formatDocument(e.target.value))} disabled={!canWrite} inputMode="numeric" /></Field>
          <Field label="Telefone"><TextInput value={f.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} disabled={!canWrite} /></Field>
          <Field label="E-mail"><TextInput value={f.email} onChange={(e) => set("email", e.target.value)} disabled={!canWrite} type="email" /></Field>
          <Field label="CEP"><TextInput value={f.zip} onChange={(e) => set("zip", formatZip(e.target.value))} disabled={!canWrite} inputMode="numeric" /></Field>
          <Field label="Rua" className="sm:col-span-2"><TextInput value={f.street} onChange={(e) => set("street", e.target.value)} disabled={!canWrite} /></Field>
          <div className="grid grid-cols-4 gap-3 sm:col-span-2">
            <Field label="Número"><TextInput value={f.number} onChange={(e) => set("number", e.target.value)} disabled={!canWrite} /></Field>
            <Field label="Bairro" className="col-span-1"><TextInput value={f.district} onChange={(e) => set("district", e.target.value)} disabled={!canWrite} /></Field>
            <Field label="Cidade"><TextInput value={f.city} onChange={(e) => set("city", e.target.value)} disabled={!canWrite} /></Field>
            <Field label="UF"><TextInput value={f.state} onChange={(e) => set("state", e.target.value.toUpperCase().slice(0, 2))} disabled={!canWrite} /></Field>
          </div>
        </div>
        <div className="border-t pt-4">
          <h3 className="mb-2 text-sm font-semibold">Estoque</h3>
          <Toggle checked={f.allow_negative_stock} onChange={(v) => set("allow_negative_stock", v)} label="Permitir vender mais do que tenho em estoque" hint="Deixe desligado para o sistema avisar quando faltar produto. Ligue se você vende antes de lançar a compra: o saldo fica negativo até a entrada ser registrada." />
        </div>
        {error && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        {canWrite && <Button type="submit" disabled={busy} className="rounded-full font-semibold">{busy ? "Salvando…" : "Salvar alterações"}</Button>}
      </form>
    </Panel>
  );
}

function Categories({ canWrite }: { canWrite: boolean }) {
  const { data, error, loading, reload } = useApi<{ categories: Category[] }>("/api/erp/categories");
  const [editing, setEditing] = useState<Category | null>(null);
  const [kind, setKind] = useState<"in" | "out">("out");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [removing, setRemoving] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const cats = data?.categories ?? [];

  async function save() {
    setFormError(null);
    if (!name.trim()) return setFormError("Informe o nome.");
    setBusy(true);
    try {
      if (editing) await call("PUT", `/api/erp/categories/${editing.id}`, { name, kind: editing.kind });
      else await call("POST", "/api/erp/categories", { name, kind });
      toast.success("Categoria salva.");
      setOpen(false);
      reload();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const group = (k: "in" | "out", title: string) => (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {canWrite && <Button size="sm" variant="outline" className="rounded-full" onClick={() => { setEditing(null); setKind(k); setName(""); setFormError(null); setOpen(true); }}><Plus size={14} /> Nova</Button>}
      </div>
      <ul className="divide-y rounded-2xl border">
        {cats.filter((c) => c.kind === k).map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
            <span className="min-w-0 truncate text-sm">{c.name}{c.used ? <span className="ml-2 text-xs text-muted-foreground">{c.used} uso(s)</span> : null}</span>
            {canWrite && (
              <span className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" aria-label={`Renomear ${c.name}`} onClick={() => { setEditing(c); setName(c.name); setFormError(null); setOpen(true); }}><Pencil size={14} /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive" aria-label={`Excluir ${c.name}`} onClick={() => setRemoving(c)}><Trash2 size={14} /></Button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <Panel>
      <h2 className="text-base font-semibold">Categorias do financeiro</h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">Classificam cada entrada e saída para os relatórios mostrarem para onde o dinheiro vai e de onde vem.</p>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data ? <LoadingRows rows={3} /> : <div className="grid grid-cols-1 gap-5 md:grid-cols-2">{group("in", "Receitas")}{group("out", "Despesas")}</div>}
      <FormDialog open={open} onOpenChange={setOpen} title={editing ? "Renomear categoria" : kind === "in" ? "Nova categoria de receita" : "Nova categoria de despesa"} onSubmit={save} busy={busy} error={formError}>
        <Field label="Nome"><TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
      </FormDialog>
      <ConfirmDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)} title={`Excluir "${removing?.name}"?`} danger confirmLabel="Excluir" onConfirm={async () => { if (removing) { try { await call("DELETE", `/api/erp/categories/${removing.id}`); toast.success("Categoria excluída."); reload(); } catch (e) { toast.error((e as Error).message); } } setRemoving(null); }}>
        Só dá para excluir categorias que nunca foram usadas.
      </ConfirmDialog>
    </Panel>
  );
}

function DemoCard({ has, canWrite, onChanged }: { has: boolean; canWrite: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  async function run(load: boolean) {
    setBusy(true);
    try {
      await call(load ? "POST" : "DELETE", "/api/erp/demo");
      toast.success(load ? "Dados de exemplo carregados." : "Dados de exemplo apagados.");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }
  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold"><Sparkles size={16} /> Dados de exemplo {has && <Tag tone="info">Carregados</Tag>}</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">Uma empresa fictícia (clientes, produtos, vendas e contas) para você explorar o sistema sem medo. Os exemplos ficam marcados e podem ser apagados de uma vez, sem mexer no que é seu.</p>
        </div>
        {canWrite && (has ? <Button variant="outline" className="rounded-full" disabled={busy} onClick={() => setConfirm(true)}>Apagar dados de exemplo</Button> : <Button variant="outline" className="rounded-full" disabled={busy} onClick={() => run(true)}>{busy ? "Carregando…" : "Carregar exemplos"}</Button>)}
      </div>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Apagar os dados de exemplo?" danger confirmLabel="Apagar exemplos" onConfirm={() => run(false)}>
        Clientes, produtos, vendas e contas de exemplo serão removidos. O que você cadastrou por conta própria continua.
      </ConfirmDialog>
    </Panel>
  );
}
