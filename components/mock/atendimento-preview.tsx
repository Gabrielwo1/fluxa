"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Bot, Check, Clock, HandCoins, MessageCircle, Receipt, ShoppingBag, Target, Timer, UserRound } from "lucide-react";
import { PageHeader } from "@/components/erp/ui";
import { CONVERSAS, FILAS, TIMELINE } from "@/lib/mock-data";
import { Glass, PreviewBanner } from "@/components/mock/bits";
import { ErpGate } from "@/components/erp/gate";
import { cn } from "@/lib/utils";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function AtendimentoPreviewPage() {
  return <ErpGate>{() => <AtendimentoPreview />}</ErpGate>;
}

function AtendimentoPreview() {
  return (
    <>
      <PageHeader
        title="Atendimento com IA"
        description="A IA responde no WhatsApp, consulta preço e estoque do ERP e monta o pedido. Prévia do Atendente Syntax dentro do Fluxa."
        help={<p>É uma amostra do Atendente Syntax, com conversas de exemplo. Em breve ele se conecta ao seu catálogo, estoque e vendas do Fluxa.</p>}
      />
      <PreviewBanner feature="atendimento-ia" title="Atendente Syntax dentro do Fluxa">
        Conversas fictícias. Na versão real a IA lê seu estoque, cria o pedido no Fluxa e você aprova antes de baixar o estoque.
      </PreviewBanner>
      <Kpis />
      <Inbox />
      <Fluxo />
    </>
  );
}

function Kpis() {
  const max = Math.max(...TIMELINE);
  const pts = TIMELINE.map((v, i) => `${(i / (TIMELINE.length - 1)) * 100},${100 - (v / max) * 86}`);
  const kpis = [
    [MessageCircle, "Conversas no mês", "412"],
    [Bot, "Resolvidas pela IA", "87%"],
    [Timer, "Resposta média", "38 s"],
    [ShoppingBag, "Pedidos criados", "63"],
    [Target, "Conversão", "24%"],
    [Clock, "Aguardando equipe", "3"],
  ] as const;
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      <section className="relative col-span-2 row-span-2 flex flex-col overflow-hidden rounded-[28px] bg-ink p-5 text-white shadow-lg shadow-black/10">
        <div className="hatch pointer-events-none absolute inset-0 opacity-40" />
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-lime/25 blur-3xl" />
        <div className="relative flex items-center justify-between"><span className="text-sm font-medium text-white/70">Vendas pelo WhatsApp</span><span className="grid size-8 place-items-center rounded-full bg-lime text-ink"><Receipt size={16} /></span></div>
        <div className="relative mt-3 flex flex-wrap items-baseline gap-3"><span className="text-4xl font-semibold tracking-tight tabular-nums">{brl(18240)}</span><span className="inline-flex items-center gap-0.5 rounded-full bg-lime/20 px-1.5 py-0.5 text-xs font-semibold text-lime"><ArrowUpRight size={12} />18%</span></div>
        <p className="relative mt-1 text-sm text-white/60">63 pedidos · vs. 30 dias anteriores</p>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="relative -mx-5 -mb-5 mt-auto h-24 w-[calc(100%+2.5rem)] pt-4" aria-hidden>
          <defs><linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e3fc3f" stopOpacity={0.5} /><stop offset="100%" stopColor="#e3fc3f" stopOpacity={0} /></linearGradient></defs>
          <path d={`M${pts.join("L")}L100,100L0,100Z`} fill="url(#heroFill)" />
          <path d={`M${pts.join("L")}`} fill="none" stroke="#e3fc3f" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
      </section>
      {kpis.map(([Icon, label, value]) => (
        <Glass key={label} className="col-span-1 xl:col-span-2 !p-4">
          <div className="flex items-center justify-between text-muted-foreground"><span className="text-[13px] font-medium">{label}</span><span className="grid size-7 place-items-center rounded-lg bg-muted"><Icon size={14} /></span></div>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        </Glass>
      ))}
    </div>
  );
}

function Inbox() {
  const [fila, setFila] = useState<(typeof FILAS)[number]["key"] | "todas">("todas");
  const [sel, setSel] = useState(CONVERSAS[0].id);
  const lista = useMemo(() => CONVERSAS.filter((c) => fila === "todas" || c.fila === fila), [fila]);
  const conv = CONVERSAS.find((c) => c.id === sel) ?? CONVERSAS[0];
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <Glass className="!p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[{ key: "todas", rotulo: "Todas" }, ...FILAS].map((f) => (
            <button key={f.key} type="button" onClick={() => setFila(f.key as typeof fila)} className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition", fila === f.key ? "border-transparent bg-ink text-white" : "border-white/90 bg-white/70 text-ink/70 hover:bg-white")}>{f.rotulo}</button>
          ))}
        </div>
        <ul className="space-y-1.5">
          {lista.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setSel(c.id)} className={cn("flex w-full items-center gap-3 rounded-2xl p-3 text-left transition", sel === c.id ? "bg-ink text-white" : "hover:bg-white/80")}>
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold", sel === c.id ? "bg-lime text-ink" : "bg-mist")}>{c.nome[0]}</span>
                <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{c.nome}</span><span className={cn("text-[11px]", sel === c.id ? "text-white/60" : "text-muted-foreground")}>{c.hora}</span></span><span className={cn("block truncate text-xs", sel === c.id ? "text-white/65" : "text-muted-foreground")}>{c.ultima}</span></span>
                {c.naoLidas > 0 && <span className="grid size-5 place-items-center rounded-full bg-lime text-[11px] font-semibold text-ink">{c.naoLidas}</span>}
              </button>
            </li>
          ))}
          {lista.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Nenhuma conversa nesta fila.</li>}
        </ul>
      </Glass>

      <section className="overflow-hidden rounded-[28px] border border-white/85 bg-[#ece5dd] shadow-[0_20px_40px_-28px_rgb(31_48_82/0.3)]">
        <div className="flex items-center gap-3 bg-[#1f2c33] px-4 py-3 text-white">
          <span className="grid size-9 place-items-center rounded-full bg-lime text-sm font-semibold text-ink">{conv.nome[0]}</span>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{conv.nome}</p><p className="text-[11px] text-white/60">{FILAS.find((f) => f.key === conv.fila)?.rotulo}</p></div>
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", conv.ia ? "bg-lime text-ink" : "bg-white/15 text-white")}>{conv.ia ? <><Bot size={12} /> IA atendendo</> : <><UserRound size={12} /> Equipe</>}</span>
        </div>
        <div key={conv.id} className="scroll-thin flex max-h-[440px] min-h-[320px] flex-col gap-2 overflow-y-auto px-4 py-4">
          {conv.msgs.map((m, i) =>
            m.de === "sistema" ? (
              <span key={i} className="mx-auto mt-1 flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[11px] text-white [animation:aparecer_.35s_ease-out]"><Check size={12} className="text-lime" /> {m.texto}</span>
            ) : (
              <p key={i} className={cn("max-w-[82%] rounded-2xl px-3 py-2 text-[13px] leading-snug text-ink shadow-sm [animation:aparecer_.35s_ease-out]", m.de === "ia" ? "self-start rounded-tl-sm bg-white" : "self-end rounded-tr-sm bg-[#d9fdd3]")}>
                {m.texto}<span className="ml-2 align-bottom text-[10px] text-ink/45">{m.hora}</span>
              </p>
            )
          )}
        </div>
      </section>
    </div>
  );
}

function Fluxo() {
  const passos = [
    ["Conecta o número", "O WhatsApp da empresa fica ligado ao Fluxa."],
    ["Lê o seu catálogo", "Preço, estoque e condições vêm direto do ERP, sempre atualizados."],
    ["Monta o pedido", "A IA responde, confirma itens e cria o pedido ou o orçamento."],
    ["Você aprova", "No começo, o dono aprova antes de baixar o estoque. Depois, libere a venda direta para pedidos pequenos."],
  ];
  return (
    <Glass className="mt-4">
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold"><HandCoins size={16} /> Como vai funcionar com o ERP</h2>
      <ol className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
        {passos.map(([t, d], i) => (
          <li key={t} className="rounded-2xl border border-white/80 bg-white/60 p-4">
            <span className="grid size-7 place-items-center rounded-full bg-ink text-xs font-semibold text-lime">{i + 1}</span>
            <p className="mt-2 text-sm font-semibold">{t}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{d}</p>
          </li>
        ))}
      </ol>
    </Glass>
  );
}
