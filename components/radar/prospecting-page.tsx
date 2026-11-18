"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Check, ChevronLeft, ChevronRight, Download, Loader2, MessageCircle, Phone, Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Panel } from "@/components/ui-kit";
import { Chips, EmptyState, ErrorNote, Field, Kpi, LoadingRows, SearchBox, SelectField, Tag, Toggle, useDebounced } from "@/components/erp/ui";
import { call, useApi } from "@/lib/erp/client";
import { fmtDate, money, todayIso } from "@/lib/erp/format";
import { formatDocument } from "@/lib/erp/validators";
import type { Known } from "@/lib/erp/services/radar";
import type { RadarCompany, RadarList } from "@/lib/radar/api";
import { cn } from "@/lib/utils";

const POR_PAGINA = 20;
const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const PORTES = [
  { valor: "1", rotulo: "Microempresa" },
  { valor: "3", rotulo: "Pequeno porte" },
  { valor: "5", rotulo: "Médio e grande" },
];
const FLAGS = [
  { chave: "com_telefone", rotulo: "Com telefone" },
  { chave: "com_email", rotulo: "Com e-mail" },
  { chave: "simples", rotulo: "Optante do Simples" },
  { chave: "mei", rotulo: "MEI" },
  { chave: "matriz", rotulo: "Somente matriz" },
] as const;
type Flag = (typeof FLAGS)[number]["chave"];

type Cnae = { codigo: number; descricao: string };
type Filtros = {
  uf: string;
  municipio: string;
  cnae: Cnae[];
  porte: string[];
  flags: Flag[];
  q: string;
  novas: boolean;
  ordem: string;
  page: number;
};

const INICIAL: Filtros = { uf: "PR", municipio: "", cnae: [], porte: [], flags: [], q: "", novas: false, ordem: "nome", page: 1 };

const twelveMonthsAgo = () => {
  const d = new Date(todayIso());
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
};

// Filtros → parâmetros da API de empresas (sem a página, para os totais).
function paraApi(f: Filtros) {
  const p = new URLSearchParams();
  if (f.uf !== "BR") p.set("uf", f.uf);
  if (f.municipio) p.set("municipio", f.municipio);
  if (f.cnae.length) p.set("cnae", f.cnae.map((c) => c.codigo).join(","));
  if (f.porte.length) p.set("porte", f.porte.join(","));
  for (const k of f.flags) p.set(k, "true");
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.novas) p.set("abertura_de", twelveMonthsAgo());
  return p;
}

// O estado dos filtros vive na URL: a busca pode ser compartilhada e o "voltar" funciona.
function lerUrl(): Filtros {
  const s = new URLSearchParams(window.location.search);
  const lista = (k: string) => (s.get(k) ?? "").split(",").filter(Boolean);
  return {
    uf: s.get("uf") || INICIAL.uf,
    municipio: s.get("municipio") ?? "",
    cnae: lista("cnae").map((c) => ({ codigo: Number(c), descricao: s.get(`cnae_${c}`) ?? String(c) })).filter((c) => c.codigo),
    porte: lista("porte"),
    flags: lista("flags").filter((k): k is Flag => FLAGS.some((f) => f.chave === k)),
    q: s.get("q") ?? "",
    novas: s.get("novas") === "1",
    ordem: s.get("ordem") || INICIAL.ordem,
    page: Math.max(Number(s.get("page")) || 1, 1),
  };
}

function gravarUrl(f: Filtros) {
  const s = new URLSearchParams();
  if (f.uf !== INICIAL.uf) s.set("uf", f.uf);
  if (f.municipio) s.set("municipio", f.municipio);
  if (f.cnae.length) {
    s.set("cnae", f.cnae.map((c) => c.codigo).join(","));
    for (const c of f.cnae) s.set(`cnae_${c.codigo}`, c.descricao);
  }
  if (f.porte.length) s.set("porte", f.porte.join(","));
  if (f.flags.length) s.set("flags", f.flags.join(","));
  if (f.q.trim()) s.set("q", f.q.trim());
  if (f.novas) s.set("novas", "1");
  if (f.ordem !== INICIAL.ordem) s.set("ordem", f.ordem);
  if (f.page > 1) s.set("page", String(f.page));
  const qs = s.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
}

const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");
function fone(v: string | null) {
  if (!v) return "";
  const d = digits(v);
  if (v.includes("•") || ![10, 11].includes(d.length)) return v;
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}
const nomeEmpresa = (e: RadarCompany) => e.nome_fantasia || e.razao_social || "Sem nome";
const endereco = (e: RadarCompany) =>
  [[e.tipo_logradouro, e.logradouro].filter(Boolean).join(" "), e.numero, e.complemento, e.bairro].filter(Boolean).join(", ");

export function ProspectingPage({ canWrite }: { canWrite: boolean }) {
  // só renderiza no navegador (o ErpGate espera o status antes), então dá para ler a URL já no início
  const [f, setF] = useState<Filtros>(() => (typeof window === "undefined" ? INICIAL : lerUrl()));
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [adicionando, setAdicionando] = useState<string | null>(null);
  const [buscaCnae, setBuscaCnae] = useState("");
  const termo = useDebounced(buscaCnae, 300);
  const texto = useDebounced(f.q, 450);

  useEffect(() => {
    gravarUrl(f);
  }, [f]);

  const aplicado = useMemo(() => ({ ...f, q: texto }), [f, texto]);
  const base = paraApi(aplicado);
  const lista = useApi<RadarList>(`/api/radar/empresas?${new URLSearchParams([...base, ["page", String(f.page)], ["limit", String(POR_PAGINA)], ["ordem", f.ordem]])}`);
  const resumo = useApi<{ total: number; com_telefone: number; com_email: number; novas_12m: number }>(`/api/radar/resumo?${base}`);
  const municipios = useApi<{ codigo: number; nome: string }[]>(f.uf !== "BR" ? `/api/radar/municipios?uf=${f.uf}` : null);
  const cnaes = useApi<Cnae[]>(termo.trim().length >= 2 ? `/api/radar/cnaes?q=${encodeURIComponent(termo.trim())}&limit=8` : null);
  const segmentos = useApi<{ segments: { cnae: number; description: string; customers: number }[]; customers: number }>("/api/erp/radar/segmentos");
  const me = useApi<{ demo?: boolean }>("/api/me");
  const cnpjs = (lista.data?.resultados ?? []).map((e) => e.cnpj).join(",");
  const cruzados = useApi<{ known: Record<string, Known> }>(cnpjs ? `/api/erp/radar/cruzar?cnpjs=${cnpjs}` : null);
  const known = cruzados.data?.known ?? {};

  const total = lista.data?.total ?? 0;
  const paginas = Math.max(Math.ceil(total / POR_PAGINA), 1);
  const nFiltros = f.cnae.length + f.porte.length + f.flags.length + (f.municipio ? 1 : 0) + (f.q ? 1 : 0) + (f.novas ? 1 : 0);

  const muda = (parcial: Partial<Filtros>) => setF((a) => ({ ...a, page: 1, ...parcial }));
  const baixar = `/api/radar/exportar?${base}`;

  async function adicionar(e: RadarCompany) {
    setAdicionando(e.cnpj);
    try {
      await call("POST", "/api/erp/parties", {
        is_customer: true,
        person_type: "pj",
        name: (e.razao_social || nomeEmpresa(e)).slice(0, 200),
        trade_name: (e.nome_fantasia ?? "").slice(0, 200),
        document: e.cnpj,
        email: e.email && !e.email.includes("•") ? e.email.toLowerCase() : "",
        phone: e.telefone1 && !e.telefone1.includes("•") ? e.telefone1.slice(0, 30) : "",
        zip: digits(e.cep).slice(0, 8),
        street: [e.tipo_logradouro, e.logradouro].filter(Boolean).join(" ").slice(0, 200),
        number: (e.numero ?? "").slice(0, 20),
        complement: (e.complemento ?? "").slice(0, 100),
        district: (e.bairro ?? "").slice(0, 100),
        city: (e.municipio ?? "").slice(0, 100),
        state: (e.uf ?? "").slice(0, 2),
        notes: `Origem: Prospecção (base da Receita Federal). ${e.cnae_descricao ?? ""}`.trim().slice(0, 2000),
        status: "lead",
      });
      toast.success("Adicionado como lead em Clientes.");
      cruzados.reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAdicionando(null);
    }
  }

  const acaoLead = (e: RadarCompany) => {
    const k = known[e.cnpj];
    if (k) {
      return (
        <Tag tone={k.status === "lead" ? "warn" : "good"}>
          {k.status === "lead" ? "Já é lead" : k.is_customer ? `Já é cliente${k.sold ? ` · ${money(k.sold)}` : ""}` : "É fornecedor"}
        </Tag>
      );
    }
    if (!canWrite) return null;
    return (
      <Button size="sm" variant="outline" className="rounded-full" disabled={adicionando === e.cnpj} onClick={() => adicionar(e)}>
        {adicionando === e.cnpj ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Adicionar como lead
      </Button>
    );
  };

  return (
    <>
      {(segmentos.data?.segments.length ?? 0) > 0 && (
        <Panel className="mb-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Sparkles size={15} /> Empresas parecidas com os seus clientes
          </p>
          <p className="mb-3 text-xs text-muted-foreground">
            Segmentos dos {segmentos.data?.customers} clientes que já têm CNPJ no cadastro. Clique para buscar empresas do mesmo ramo.
          </p>
          <div className="flex flex-wrap gap-2">
            {segmentos.data?.segments.map((s) => (
              <button
                key={s.cnae}
                type="button"
                onClick={() => muda({ cnae: [{ codigo: s.cnae, descricao: s.description }] })}
                className="rounded-full border border-ink/15 bg-white/70 px-3 py-1.5 text-left text-xs font-medium transition hover:border-ink/40 hover:bg-white"
              >
                {s.description} <span className="text-muted-foreground">· {s.customers} cliente{s.customers > 1 ? "s" : ""}</span>
              </button>
            ))}
          </div>
        </Panel>
      )}

      <Panel className="mb-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Estado">
            <SelectField
              value={f.uf}
              onChange={(uf) => muda({ uf, municipio: "" })}
              options={[{ value: "BR", label: "Brasil inteiro" }, ...UFS.map((u) => ({ value: u, label: u }))]}
            />
          </Field>
          <Field label="Cidade">
            <SelectField
              value={f.municipio}
              onChange={(municipio) => muda({ municipio })}
              placeholder={f.uf === "BR" ? "Escolha um estado" : "Todas as cidades"}
              disabled={f.uf === "BR"}
              options={(municipios.data ?? []).map((m) => ({ value: String(m.codigo), label: m.nome }))}
            />
          </Field>
          <div className="relative md:col-span-2">
            <Field label="Segmento (atividade)">
              <SearchBox value={buscaCnae} onChange={setBuscaCnae} placeholder="Ex.: padaria, oficina, clínica…" />
            </Field>
            {termo.trim().length >= 2 && (cnaes.data?.length ?? 0) > 0 && buscaCnae.trim().length >= 2 && (
              <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-2xl border bg-card p-1 shadow-lg">
                {cnaes.data?.map((c) => (
                  <li key={c.codigo}>
                    <button
                      type="button"
                      className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        muda({ cnae: f.cnae.some((x) => x.codigo === c.codigo) ? f.cnae : [...f.cnae, c] });
                        setBuscaCnae("");
                      }}
                    >
                      {c.descricao} <span className="text-xs text-muted-foreground">{c.codigo}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {f.cnae.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {f.cnae.map((c) => (
              <span key={c.codigo} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-xs font-medium text-white">
                {c.descricao}
                <button type="button" aria-label={`Tirar ${c.descricao}`} onClick={() => muda({ cnae: f.cnae.filter((x) => x.codigo !== c.codigo) })}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <SearchBox value={f.q} onChange={(q) => muda({ q })} placeholder="Nome da empresa ou CNPJ" />
          <Chips<string>
            label="Porte"
            value={f.porte[0] ?? ""}
            onChange={(v) => muda({ porte: v ? [v] : [] })}
            options={[{ value: "", label: "Todos os portes" }, ...PORTES.map((p) => ({ value: p.valor, label: p.rotulo }))]}
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FLAGS.map((t) => (
            <Toggle
              key={t.chave}
              checked={f.flags.includes(t.chave)}
              onChange={(on) => muda({ flags: on ? [...f.flags, t.chave] : f.flags.filter((x) => x !== t.chave) })}
              label={t.rotulo}
            />
          ))}
          <Toggle checked={f.novas} onChange={(novas) => muda({ novas })} label="Abertas no último ano" hint="Empresas novas costumam comprar mais" />
        </div>

        {nFiltros > 0 && (
          <button type="button" className="mt-3 text-xs font-medium text-muted-foreground underline" onClick={() => setF({ ...INICIAL, uf: f.uf })}>
            Limpar filtros
          </button>
        )}
      </Panel>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Empresas encontradas" value={lista.data ? total.toLocaleString("pt-BR") : "…"} />
        <Kpi
          label="Com telefone"
          value={resumo.data ? resumo.data.com_telefone.toLocaleString("pt-BR") : "…"}
          sub={resumo.data && resumo.data.total ? `${Math.round((resumo.data.com_telefone / resumo.data.total) * 100)}% da busca` : undefined}
        />
        <Kpi label="Abertas no último ano" value={resumo.data ? resumo.data.novas_12m.toLocaleString("pt-BR") : "…"} />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="w-56">
          <SelectField
            value={f.ordem}
            onChange={(ordem) => muda({ ordem })}
            options={[
              { value: "nome", label: "Ordem alfabética" },
              { value: "abertura_desc", label: "Mais novas primeiro" },
              { value: "capital_desc", label: "Maior capital social" },
            ]}
          />
        </div>
        {!me.data?.demo && total > 0 && (
          <a href={baixar} className="inline-flex h-9 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium hover:bg-muted">
            <Download size={15} /> Baixar planilha (CSV)
          </a>
        )}
      </div>

      {lista.error && <ErrorNote message={lista.error} onRetry={lista.reload} />}
      {!lista.data && !lista.error && <LoadingRows rows={6} />}
      {lista.data && lista.data.resultados.length === 0 && (
        <EmptyState icon={Building2} title="Nenhuma empresa com esses filtros">
          Tente tirar algum filtro ou escolher outra cidade.
        </EmptyState>
      )}

      <ul className={cn("space-y-2", lista.loading && "opacity-60 transition-opacity")}>
        {lista.data?.resultados.map((e) => {
          const wa = e.telefone1 && !e.telefone1.includes("•") ? `https://wa.me/55${digits(e.telefone1)}` : null;
          return (
            <li key={e.cnpj} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button type="button" onClick={() => setDetalhe(e.cnpj)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-semibold">{nomeEmpresa(e)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDocument(e.cnpj)} · {e.cnae_descricao ?? "Atividade não informada"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[e.municipio && `${e.municipio}/${e.uf}`, e.porte_descricao, e.data_abertura && `desde ${fmtDate(e.data_abertura)}`].filter(Boolean).join(" · ")}
                  </p>
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  {e.telefone1 && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone size={13} /> {fone(e.telefone1)}
                    </span>
                  )}
                  {wa && (
                    <a href={wa} target="_blank" rel="noreferrer" aria-label="Chamar no WhatsApp" className="grid size-8 place-items-center rounded-full bg-[#25d366] text-[#06361a]">
                      <MessageCircle size={15} />
                    </a>
                  )}
                  {acaoLead(e)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {total > POR_PAGINA && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button variant="outline" className="rounded-full" disabled={f.page <= 1} onClick={() => setF({ ...f, page: f.page - 1 })}>
            <ChevronLeft size={15} /> Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {f.page} de {paginas.toLocaleString("pt-BR")}
          </span>
          <Button variant="outline" className="rounded-full" disabled={f.page >= paginas} onClick={() => setF({ ...f, page: f.page + 1 })}>
            Próxima <ChevronRight size={15} />
          </Button>
        </div>
      )}

      <Detalhe cnpj={detalhe} onClose={() => setDetalhe(null)} known={detalhe ? known[detalhe] : undefined} onAdd={adicionar} adicionando={adicionando} canWrite={canWrite} />
    </>
  );
}

type Detail = RadarCompany & { cnaes_secundarios_detalhe?: Cnae[] };

function Detalhe({ cnpj, onClose, known, onAdd, adicionando, canWrite }: { cnpj: string | null; onClose: () => void; known?: Known; onAdd: (e: RadarCompany) => void; adicionando: string | null; canWrite: boolean }) {
  const { data, error } = useApi<Detail>(cnpj ? `/api/radar/empresas/${cnpj}` : null);
  const e = data?.cnpj === cnpj ? data : undefined;
  const linha = (rotulo: string, valor: React.ReactNode) =>
    valor ? (
      <div>
        <dt className="text-xs text-muted-foreground">{rotulo}</dt>
        <dd className="text-sm font-medium">{valor}</dd>
      </div>
    ) : null;
  return (
    <Sheet open={Boolean(cnpj)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-b p-5 pr-14">
          <SheetTitle className="text-lg font-bold">{e ? nomeEmpresa(e) : "Empresa"}</SheetTitle>
          <SheetDescription>{cnpj ? formatDocument(cnpj) : ""}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 p-5">
          {error && <ErrorNote message={error} />}
          {!e && !error && <LoadingRows rows={4} />}
          {e && (
            <>
              <div className="flex flex-wrap gap-2">
                {e.situacao_descricao && <Tag tone={e.situacao === 2 ? "good" : "warn"}>{e.situacao_descricao}</Tag>}
                {e.porte_descricao && <Tag>{e.porte_descricao}</Tag>}
                {e.mei && <Tag tone="info">MEI</Tag>}
                {e.simples && <Tag tone="info">Simples</Tag>}
                {e.matriz && <Tag>Matriz</Tag>}
              </div>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {linha("Razão social", e.razao_social)}
                {linha("Atividade principal", e.cnae_descricao)}
                {linha("Abertura", e.data_abertura ? fmtDate(e.data_abertura) : null)}
                {linha("Capital social", e.capital_social ? money(e.capital_social) : null)}
                {linha("Telefone", e.telefone1 && fone(e.telefone1))}
                {linha("Telefone 2", e.telefone2 && fone(e.telefone2))}
                {linha("E-mail", e.email)}
                {linha("Endereço", [endereco(e), e.cep && `CEP ${e.cep}`, e.municipio && `${e.municipio}/${e.uf}`].filter(Boolean).join(" · "))}
              </dl>
              {(e.cnaes_secundarios_detalhe?.length ?? 0) > 0 && (
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Outras atividades</p>
                  <ul className="space-y-1 text-sm">
                    {e.cnaes_secundarios_detalhe?.slice(0, 8).map((c) => (
                      <li key={c.codigo}>{c.descricao}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                {known ? (
                  <Tag tone="good">
                    <Check size={12} className="mr-1" /> {known.status === "lead" ? "Já é lead no Fluxa" : "Já está no seu cadastro"}
                  </Tag>
                ) : (
                  canWrite && (
                    <Button className="rounded-full" disabled={adicionando === e.cnpj} onClick={() => onAdd(e)}>
                      {adicionando === e.cnpj ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Adicionar como lead
                    </Button>
                  )
                )}
                {e.telefone1 && !e.telefone1.includes("•") && (
                  <a href={`https://wa.me/55${digits(e.telefone1)}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-full bg-[#25d366] px-4 text-sm font-semibold text-[#06361a]">
                    <MessageCircle size={15} /> WhatsApp
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
