"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { call } from "@/lib/erp/client";
import type { Party } from "@/lib/erp/types";
import { digits, formatDocument, formatPhone, formatZip, isValidDocument } from "@/lib/erp/validators";
import { Field, FormSheet, SelectField, TextArea, TextInput, Toggle } from "@/components/erp/ui";


type Form = {
  is_customer: boolean;
  is_supplier: boolean;
  person_type: "pf" | "pj";
  name: string;
  trade_name: string;
  document: string;
  email: string;
  phone: string;
  zip: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  notes: string;
  status: "lead" | "active" | "inactive";
};

const empty = (role: "customer" | "supplier"): Form => ({
  is_customer: role === "customer",
  is_supplier: role === "supplier",
  person_type: "pf",
  name: "",
  trade_name: "",
  document: "",
  email: "",
  phone: "",
  zip: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  notes: "",
  status: "active",
});

const fromParty = (p: Party): Form => ({
  is_customer: p.is_customer,
  is_supplier: p.is_supplier,
  person_type: p.person_type,
  name: p.name,
  trade_name: p.trade_name,
  document: formatDocument(p.document),
  email: p.email,
  phone: formatPhone(p.phone),
  zip: formatZip(p.zip),
  street: p.street,
  number: p.number,
  complement: p.complement,
  district: p.district,
  city: p.city,
  state: p.state,
  notes: p.notes,
  status: p.status,
});

// Cadastro de cliente ou fornecedor. Também preenche o endereço pelo CEP e os dados pelo CNPJ.
export function PartyFormSheet({
  open,
  onOpenChange,
  party,
  role = "customer",
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  party?: Party | null;
  role?: "customer" | "supplier";
  onSaved: (p: Party) => void;
}) {
  // o formulário é recriado (key) a cada abertura, então começa sempre com os dados certos
  return open ? (
    <PartyFormInner key={party?.id ?? `new-${role}`} onOpenChange={onOpenChange} party={party} role={role} onSaved={onSaved} />
  ) : null;
}

function PartyFormInner({
  onOpenChange,
  party,
  role,
  onSaved,
}: {
  onOpenChange: (o: boolean) => void;
  party?: Party | null;
  role: "customer" | "supplier";
  onSaved: (p: Party) => void;
}) {
  const [f, setF] = useState<Form>(() => (party ? fromParty(party) : empty(role)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<"cnpj" | "cep" | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));
  const docDigits = digits(f.document);
  const docError =
    docDigits.length > 0 && (docDigits.length === 11 || docDigits.length === 14) && !isValidDocument(docDigits)
      ? "CPF ou CNPJ inválido. Confira os números."
      : null;

  async function fillFromCnpj() {
    setLookup("cnpj");
    try {
      const res = await fetch(`/api/erp/lookup/cnpj?cnpj=${docDigits}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Não foi possível consultar o CNPJ.");
      setF((s) => ({
        ...s,
        person_type: "pj",
        name: d.name || s.name,
        trade_name: d.trade_name || s.trade_name,
        email: s.email || d.email,
        phone: s.phone || formatPhone(d.phone ?? ""),
        zip: formatZip(d.zip ?? ""),
        street: d.street,
        number: d.number,
        complement: d.complement,
        district: d.district,
        city: d.city,
        state: d.state,
      }));
      toast.success("Dados preenchidos pela Receita Federal.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLookup(null);
    }
  }

  async function fillFromCep(raw: string) {
    const cep = digits(raw);
    if (cep.length !== 8) return;
    setLookup("cep");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = await res.json();
      if (d.erro) throw new Error("CEP não encontrado.");
      setF((s) => ({
        ...s,
        street: d.logradouro || s.street,
        district: d.bairro || s.district,
        city: d.localidade || s.city,
        state: d.uf || s.state,
      }));
    } catch {
      // sem internet ou CEP desconhecido: a pessoa preenche à mão
    } finally {
      setLookup(null);
    }
  }

  async function save() {
    setError(null);
    if (!f.name.trim()) return setError("Informe o nome.");
    if (!f.is_customer && !f.is_supplier) return setError("Marque se é cliente, fornecedor ou os dois.");
    setBusy(true);
    try {
      const saved = party
        ? await call<Party>("PUT", `/api/erp/parties/${party.id}`, f)
        : await call<Party>("POST", "/api/erp/parties", f);
      toast.success(party ? "Cadastro atualizado." : "Cadastro criado.");
      onSaved(saved);
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const supplierOnly = f.is_supplier && !f.is_customer;

  return (
    <FormSheet
      open
      onOpenChange={onOpenChange}
      title={party ? "Editar cadastro" : supplierOnly ? "Novo fornecedor" : "Novo cliente"}
      description="Só o nome é obrigatório. Quanto mais completo, mais fácil cobrar e vender depois."
      onSubmit={save}
      busy={busy}
      error={error}
    >
      <div className="grid grid-cols-2 gap-2">
        <Toggle checked={f.is_customer} onChange={(v) => set("is_customer", v)} label="É cliente" hint="Compra de você" />
        <Toggle checked={f.is_supplier} onChange={(v) => set("is_supplier", v)} label="É fornecedor" hint="Vende para você" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo de pessoa">
          <SelectField
            value={f.person_type}
            onChange={(v) => set("person_type", v as "pf" | "pj")}
            options={[
              { value: "pf", label: "Pessoa física (CPF)" },
              { value: "pj", label: "Empresa (CNPJ)" },
            ]}
          />
        </Field>
        <Field label={f.person_type === "pj" ? "CNPJ" : "CPF"} error={docError}>
          <div className="flex gap-2">
            <TextInput
              value={f.document}
              onChange={(e) => set("document", formatDocument(e.target.value))}
              inputMode="numeric"
              placeholder={f.person_type === "pj" ? "00.000.000/0000-00" : "000.000.000-00"}
            />
            {docDigits.length === 14 && (
              <Button type="button" variant="outline" className="h-11 shrink-0 rounded-xl" onClick={fillFromCnpj} disabled={lookup === "cnpj"} title="Preencher com os dados da Receita Federal">
                {lookup === "cnpj" ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </Button>
            )}
          </div>
        </Field>
      </div>

      <Field label={f.person_type === "pj" ? "Razão social" : "Nome completo"} required>
        <TextInput value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus placeholder={f.person_type === "pj" ? "Nome da empresa" : "Como a pessoa se chama"} />
      </Field>
      {f.person_type === "pj" && (
        <Field label="Nome fantasia" hint="Como a empresa é conhecida no dia a dia.">
          <TextInput value={f.trade_name} onChange={(e) => set("trade_name", e.target.value)} />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Telefone / WhatsApp">
          <TextInput value={f.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} inputMode="tel" placeholder="(11) 90000-0000" />
        </Field>
        <Field label="E-mail">
          <TextInput value={f.email} onChange={(e) => set("email", e.target.value)} type="email" placeholder="nome@empresa.com" />
        </Field>
      </div>

      {f.is_customer && (
        <Field label="Situação do cliente" hint="Lead é quem ainda está negociando e não comprou.">
          <SelectField
            value={f.status}
            onChange={(v) => set("status", v as Form["status"])}
            options={[
              { value: "active", label: "Ativo" },
              { value: "lead", label: "Lead (em negociação)" },
              { value: "inactive", label: "Inativo (arquivado)" },
            ]}
          />
        </Field>
      )}

      <div className="rounded-2xl border p-4">
        <p className="mb-3 text-sm font-semibold">Endereço</p>
        <div className="grid grid-cols-6 gap-3">
          <Field label="CEP" className="col-span-2">
            <div className="relative">
              <TextInput
                value={f.zip}
                onChange={(e) => {
                  const z = formatZip(e.target.value);
                  set("zip", z);
                  void fillFromCep(z);
                }}
                inputMode="numeric"
                placeholder="00000-000"
              />
              {lookup === "cep" && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
            </div>
          </Field>
          <Field label="Rua" className="col-span-4">
            <TextInput value={f.street} onChange={(e) => set("street", e.target.value)} />
          </Field>
          <Field label="Número" className="col-span-2">
            <TextInput value={f.number} onChange={(e) => set("number", e.target.value)} />
          </Field>
          <Field label="Complemento" className="col-span-4">
            <TextInput value={f.complement} onChange={(e) => set("complement", e.target.value)} />
          </Field>
          <Field label="Bairro" className="col-span-3">
            <TextInput value={f.district} onChange={(e) => set("district", e.target.value)} />
          </Field>
          <Field label="Cidade" className="col-span-2">
            <TextInput value={f.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="UF" className="col-span-1">
            <TextInput value={f.state} onChange={(e) => set("state", e.target.value.toUpperCase().slice(0, 2))} />
          </Field>
        </div>
      </div>

      <Field label="Observações" hint="Preferências, combinados, qualquer coisa que ajude a lembrar.">
        <TextArea value={f.notes} onChange={(v) => set("notes", v)} />
      </Field>
    </FormSheet>
  );
}
