"use client";

import { useState } from "react";
import { MessageCircle, Phone, Plus, Search, Star } from "lucide-react";
import { Chips, PageHeader } from "@/components/erp/ui";
import { useApi } from "@/lib/erp/client";
import { money } from "@/lib/erp/format";
import type { Product } from "@/lib/erp/types";
import { MAP_SIZE, STATES } from "@/lib/brasil-mapa";
import { ABERTURAS_POR_ANO, DENSIDADE_UF, ETAPAS, LEADS, PROSPECTS, TOP_CIDADES } from "@/lib/mock-data";
import { Glass, PreviewBanner, compact } from "@/components/mock/bits";
import { ErpGate } from "@/components/erp/gate";
import { cn } from "@/lib/utils";

type Aba = "prospeccao" | "crm" | "catalogo";

const initials = (n: string) => n.split(" ").filter((p) => p.length > 2).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

export function RadarPreviewPage() {
  return <ErpGate>{() => <RadarPreview />}</ErpGate>;
}

function RadarPreview() {
  const [aba, setAba] = useState<Aba>("prospeccao");
  return (
    <>
      <PageHeader
        title="Prospecção"
        description="Encontre empresas que compram o que você vende, direto da base aberta da Receita Federal. Prévia do Radar Empresas dentro do Fluxa."
        help={<p>É uma amostra do Radar Empresas (b2bradar.pro), com dados de exemplo. Em breve ele se conecta ao seu catálogo e ao CRM do Fluxa.</p>}
      />
      <PreviewBanner feature="prospeccao" title="Radar Empresas dentro do Fluxa">
        Dados fictícios. A versão real busca na base da Receita e sugere clientes a partir dos produtos que você já cadastrou.
      </PreviewBanner>
      <div className="mb-4">
        <Chips<Aba> label="Visão" value={aba} onChange={setAba} options={[{ value: "prospeccao", label: "Prospecção" }, { value: "crm", label: "CRM de leads" }, { value: "catalogo", label: "Sugestões do seu catálogo" }]} />
      </div>
      {aba === "prospeccao" && <Prospeccao />}
      {aba === "crm" && <Crm />}
      {aba === "catalogo" && <Catalogo />}
    </>
  );
}

function Prospeccao() {
  const max = TOP_CIDADES[0].total;
  const maxAno = Math.max(...ABERTURAS_POR_ANO);
  const [filtro, setFiltro] = useState<"todas" | "telefone" | "novas" | "salvos">("todas");
  const [salvos, setSalvos] = useState<Set<string>>(new Set(["Clínica Vida Plena"]));
  const lista = PROSPECTS.filter((p) => (filtro === "telefone" ? p.tel : filtro === "novas" ? p.nova : filtro === "salvos" ? salvos.has(p.nome) : true));

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center gap-2" aria-label="Filtros de exemplo">
        {["PR · Paraná", "Curitiba e região", "CNAE 4761-0 · Papelaria", "Porte ME e EPP", "Com telefone"].map((f, i) => (
          <span key={f} className={cn("inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm", i === 0 ? "border-ink bg-ink text-white" : "border-white/90 bg-white/70 text-ink/75")}>
            {i === 0 && <Search size={14} />}{f}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Glass>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div><p className="text-sm text-ink/60">Empresas encontradas</p><p className="mt-1 text-[30px] leading-none tracking-tight tabular-nums">18,4 mil</p><p className="mt-1 text-xs text-muted-foreground">empresas ativas</p></div>
            <div><p className="text-sm text-ink/60">Com telefone</p><p className="mt-1 text-[30px] leading-none tracking-tight tabular-nums">71%</p><p className="mt-1 text-xs text-muted-foreground">13 mil com contato</p></div>
            <div>
              <p className="text-sm text-ink/60">Novas em 12 meses</p>
              <div className="mt-1 flex items-end gap-3">
                <span className="text-[30px] leading-none tracking-tight tabular-nums">1,4 mil</span>
                <div className="flex h-9 items-end gap-[3px]" aria-hidden>
                  {ABERTURAS_POR_ANO.map((a, i) => <span key={i} style={{ height: `${Math.max(12, (a / maxAno) * 100)}%` }} className={cn("w-[6px] rounded-full", i === ABERTURAS_POR_ANO.length - 1 ? "bg-ink" : "bg-steel/60")} />)}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <p className="mb-3 text-sm text-ink/60">Cidades com mais empresas</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-5">
              {TOP_CIDADES.map((c) => (
                <div key={c.nome}>
                  <span className="block truncate text-sm">{c.nome}</span>
                  <span className="mt-2 block h-2.5 w-full rounded-full bg-ink/[0.07]"><span className="bar-lime block h-full rounded-full" style={{ width: `${Math.max(8, (c.total / max) * 100)}%` }} /></span>
                  <span className="mt-1.5 block text-xs text-muted-foreground">{compact(c.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </Glass>
        <Glass className="flex flex-col">
          <div className="mb-2 flex items-center justify-between"><p className="text-sm text-ink/60">Mapa de calor</p><span className="text-xs text-muted-foreground">empresas por estado</span></div>
          <svg viewBox={`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`} role="img" aria-label="Mapa do Brasil com a concentração de empresas por estado" className="mx-auto max-h-[260px] w-full">
            {STATES.map((s) => {
              const d = DENSIDADE_UF[s.uf] ?? 0.05;
              return <path key={s.uf} d={s.d} fill={`color-mix(in oklab, #141518 ${Math.round(8 + d * 78)}%, #edf2f9)`} stroke="#fff" strokeWidth={1} />;
            })}
          </svg>
        </Glass>
      </div>

      <section className="relative mt-6 rounded-[34px] bg-coal p-4 pt-6 text-white sm:p-6">
        <div className="absolute -top-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-b-[26px] rounded-t-[22px] bg-[#eef3fa] p-2">
          {([["todas", "Todas"], ["telefone", "Com telefone"], ["novas", "Novas"], ["salvos", "Salvos"]] as const).map(([id, r]) => (
            <button key={id} type="button" onClick={() => setFiltro(id)} className={cn("h-9 rounded-full px-4 text-sm transition", filtro === id ? "bg-ink text-white" : "text-ink/60 hover:text-ink")}>{r}</button>
          ))}
        </div>
        <ul className="mt-4 divide-y divide-white/10">
          {lista.map((p) => (
            <li key={p.nome} className="flex flex-wrap items-center gap-3 py-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-medium">{initials(p.nome)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.nome}</p>
                <p className="truncate text-xs text-white/55">{p.cnae} · {p.cidade}/{p.uf}</p>
              </div>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs">{p.porte}</span>
              {p.nova && <span className="rounded-full bg-lime px-2.5 py-1 text-xs font-medium text-ink">nova</span>}
              <span className="flex items-center gap-1.5 text-white/55">
                <Phone size={15} className={p.tel ? "text-white" : "opacity-30"} />
                <MessageCircle size={15} className={p.tel ? "text-lime" : "opacity-30"} />
              </span>
              <button type="button" aria-label={`Salvar ${p.nome}`} onClick={() => setSalvos((s) => { const n = new Set(s); if (n.has(p.nome)) n.delete(p.nome); else n.add(p.nome); return n; })} className="grid size-9 place-items-center rounded-full bg-white/10 hover:bg-white/20">
                <Star size={15} className={salvos.has(p.nome) ? "fill-lime text-lime" : ""} />
              </button>
            </li>
          ))}
          {lista.length === 0 && <li className="py-8 text-center text-sm text-white/55">Nenhuma empresa neste filtro.</li>}
        </ul>
      </section>
    </div>
  );
}

function Crm() {
  const total = LEADS.filter((l) => l.etapa !== "ganho").reduce((s, l) => s + l.valor, 0);
  const ganho = LEADS.filter((l) => l.etapa === "ganho").reduce((s, l) => s + l.valor, 0);
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Leads em aberto", String(LEADS.filter((l) => l.etapa !== "ganho").length)], ["Valor em aberto", money(total)], ["Ganhos", money(ganho)], ["Conversão", "38%"]].map(([l, v]) => (
          <Glass key={l} className="!p-4"><p className="text-sm text-ink/60">{l}</p><p className="mt-1 text-2xl tracking-tight tabular-nums">{v}</p></Glass>
        ))}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {ETAPAS.map((e) => {
          const cards = LEADS.filter((l) => l.etapa === e.id);
          return (
            <div key={e.id} className="w-[240px] shrink-0 rounded-[24px] p-3" style={{ background: e.fundo }}>
              <p className="mb-3 flex items-center justify-between px-1 text-sm font-medium"><span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: e.cor }} />{e.rotulo}</span><span className="text-xs text-muted-foreground">{cards.length}</span></p>
              <div className="space-y-2">
                {cards.map((c) => (
                  <div key={c.nome} className="glass rounded-2xl p-3">
                    <p className="truncate text-sm font-medium">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">{c.cidade}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {c.valor > 0 && <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] text-white">{money(c.valor)}</span>}
                      {c.acao && <span className="rounded-full bg-lime px-2 py-0.5 text-[11px] font-medium text-ink">{c.acao}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Ponte com o ERP: usa os produtos cadastrados de verdade para mostrar a ideia da prospecção automática.
function Catalogo() {
  const { data } = useApi<{ products: Product[] }>("/api/erp/products?active=true&limit=6");
  const reais = (data?.products ?? []).filter((p) => p.kind === "product" || p.kind === "service").slice(0, 5);
  const itens = reais.length ? reais.map((p) => p.name) : ["Caderno universitário", "Papel sulfite A4", "Cartucho de tinta", "Instalação de rede"];
  const perfis = ["Papelarias e escritórios", "Escolas e cursos", "Lojas de informática", "Pequenas indústrias", "Contabilidades"];
  return (
    <Glass>
      <h2 className="text-base font-semibold">Quem compra o que você vende</h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">{reais.length ? "Montado a partir dos produtos do seu catálogo." : "Exemplo com produtos fictícios. Cadastre os seus em Produtos e serviços."} Para cada item, o Radar sugere os segmentos e a região com mais chance de compra.</p>
      <ul className="divide-y">
        {itens.map((nome, i) => (
          <li key={nome} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{nome}</p>
              <p className="text-xs text-muted-foreground">Perfil sugerido: {perfis[i % perfis.length]} · PR e SC</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm tabular-nums"><strong>{compact(1200 + ((i * 937) % 3400))}</strong> empresas</span>
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-xs font-medium text-white opacity-60"><Plus size={13} /> Buscar no Radar</span>
            </div>
          </li>
        ))}
      </ul>
    </Glass>
  );
}
