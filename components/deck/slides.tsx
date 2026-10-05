"use client";

import {
  ArrowRight,
  BellRing,
  Building2,
  CalendarClock,
  Check,
  EyeOff,
  FileSpreadsheet,
  GitBranch,
  KeyRound,
  Landmark,
  Layers,
  LineChart,
  ListChecks,
  Lock,
  Scale,
  ShieldCheck,
  Sparkles,
  UserX,
  Users,
  Wallet,
  Workflow,
  X,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { CtaLink } from "@/components/site/cta";
import { BrandMark } from "@/components/site/site-header";
import { DemoDashboard } from "@/components/site/demo-dashboard";
import { MiniForecast, MiniLearning } from "@/components/site/mini-visuals";
import type { Slide } from "./deck";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      {children}
    </p>
  );
}

function Title({ children, size = "lg" }: { children: React.ReactNode; size?: "lg" | "xl" }) {
  return (
    <h2
      className={cn(
        "font-semibold leading-[1.08] tracking-[-0.03em]",
        size === "xl" ? "text-4xl sm:text-5xl lg:text-6xl" : "text-3xl sm:text-4xl lg:text-5xl"
      )}
    >
      {children}
    </h2>
  );
}

function Mark({ children }: { children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap bg-[linear-gradient(transparent_62%,color-mix(in_oklch,var(--primary)_55%,transparent)_62%)] px-0.5 [box-decoration-break:clone]">
      {children}
    </span>
  );
}

const Lead = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-5 max-w-2xl text-base text-muted-foreground md:text-xl">{children}</p>
);

const iconBox = "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/25";

// ---------------------------------------------------------------- 1. capa
function Cover() {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
      <div>
        <BrandMark className="mb-8" />
        <Title size="xl">
          O financeiro da sua empresa, <Mark>do jeito</Mark> da sua empresa.
        </Title>
        <Lead>
          {BRAND.name} é um sistema financeiro totalmente personalizável, conectado
          aos seus bancos e modelado com as regras do seu negócio.
        </Lead>
        <ul className="mt-8 flex flex-wrap gap-2">
          {["Open Finance", "Somente leitura", "Sob medida"].map((t) => (
            <li key={t} className="rounded-full border bg-card px-4 py-1.5 text-sm font-medium">
              {t}
            </li>
          ))}
        </ul>
      </div>
      <DemoDashboard />
    </div>
  );
}

// ---------------------------------------------------------------- 2. problema
function Problem() {
  const items = [
    { Icon: FileSpreadsheet, t: "Extratos de vários bancos", d: "Alguém junta tudo à mão, todo mês. Quando fica pronto, os números já envelheceram." },
    { Icon: UserX, t: "Rotina na cabeça de uma pessoa", d: "Aprovações, categorias e contas recorrentes dependem de quem sabe de cor." },
    { Icon: CalendarClock, t: "Surpresa no fim do mês", d: "Parcelas, contas fixas e vencimentos aparecem tarde demais para agir." },
  ];
  return (
    <div>
      <Eyebrow>O problema</Eyebrow>
      <Title>Cada empresa é diferente. O financeiro quase nunca acompanha.</Title>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {items.map(({ Icon, t, d }) => (
          <div key={t} className="rounded-3xl border bg-card p-6">
            <span className={cn(iconBox, "mb-5")}>
              <Icon size={20} />
            </span>
            <h3 className="text-xl font-semibold">{t}</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 3. por que o pronto não basta
function Versus() {
  const rows: [string, string, string][] = [
    ["Categorias", "As do fornecedor, iguais para todos", "As da sua empresa, por fornecedor e por regra"],
    ["Aprovações", "Um fluxo único para todo mundo", "O fluxo que a sua empresa já usa"],
    ["Relatórios", "Modelos prontos", "No formato que a diretoria lê"],
    ["Quando algo muda", "Abrir chamado e esperar a próxima versão", "Ajustamos com você na revisão mensal"],
    ["Bancos", "Cada banco em um canto", "Todos num só painel, atualizado"],
  ];
  return (
    <div>
      <Eyebrow>Por que o sistema pronto não basta</Eyebrow>
      <Title>
        Ferramenta de prateleira obriga a empresa a <Mark>se adaptar</Mark> a ela.
      </Title>
      <div className="mt-10 overflow-hidden rounded-3xl border bg-card">
        <div className="grid grid-cols-[1fr_1.4fr_1.4fr] border-b bg-muted/50 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <span className="p-4" />
          <span className="p-4">Sistema de prateleira</span>
          <span className="p-4 text-foreground">{BRAND.name} sob medida</span>
        </div>
        {rows.map(([k, a, b]) => (
          <div key={k} className="grid grid-cols-[1fr_1.4fr_1.4fr] border-b text-sm last:border-b-0 md:text-base">
            <span className="p-4 font-semibold">{k}</span>
            <span className="flex items-start gap-2 p-4 text-muted-foreground">
              <X size={16} className="mt-1 shrink-0 text-bad" /> {a}
            </span>
            <span className="flex items-start gap-2 bg-primary/10 p-4">
              <Check size={16} className="mt-1 shrink-0 text-good" /> {b}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 4. a ideia
function Idea() {
  const layers = [
    { n: "1", Icon: Landmark, t: "Os seus bancos", d: "Contas, cartões e investimentos lidos pelo Open Finance, com a sua autorização." },
    { n: "2", Icon: Layers, t: "As regras da sua empresa", d: "Categorias, centros de custo, contas recorrentes, aprovações e limites." },
    { n: "3", Icon: LineChart, t: "O painel e as rotinas", d: "O caixa, a previsão e os alertas do jeito que o seu financeiro lê e age." },
  ];
  return (
    <div>
      <Eyebrow>A ideia</Eyebrow>
      <Title>
        Um financeiro <Mark>totalmente personalizável</Mark>.
      </Title>
      <div className="mt-10 grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
        {layers.flatMap((l, i) => {
          const card = (
            <div key={l.n} className="rounded-3xl border bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {l.n}
                </span>
                <l.Icon size={22} />
              </div>
              <h3 className="text-xl font-semibold">{l.t}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">{l.d}</p>
            </div>
          );
          return i < layers.length - 1
            ? [card, <ArrowRight key={`a${i}`} className="mx-auto hidden self-center text-muted-foreground lg:block" />]
            : [card];
        })}
      </div>
      <p className="mt-8 max-w-3xl text-lg text-muted-foreground md:text-xl">
        Os dados dos bancos são os mesmos para todo mundo. O que muda é{" "}
        <strong className="font-semibold text-foreground">como a sua empresa os lê e age sobre eles</strong>.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- 5. o que se personaliza
function Customizable() {
  const items = [
    { Icon: Layers, t: "Categorias e centros de custo" },
    { Icon: CalendarClock, t: "Contas fixas e recorrentes" },
    { Icon: GitBranch, t: "Fluxos de aprovação" },
    { Icon: BellRing, t: "Alertas e limites" },
    { Icon: ListChecks, t: "Relatórios da diretoria" },
    { Icon: LineChart, t: "Previsão de caixa" },
    { Icon: Users, t: "Perfis de acesso" },
    { Icon: Wallet, t: "Calendário de pagamentos" },
  ];
  return (
    <div>
      <Eyebrow>O que se personaliza</Eyebrow>
      <Title>O sistema se molda à rotina, não o contrário.</Title>
      <Lead>Cada item abaixo é configurado com o seu financeiro, na construção assistida.</Lead>
      <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        {items.map(({ Icon, t }) => (
          <div key={t} className="flex flex-col gap-4 rounded-3xl border bg-card p-5">
            <span className={iconBox}>
              <Icon size={20} />
            </span>
            <p className="font-semibold leading-snug">{t}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 6. painel ao vivo
function Panel() {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <DemoDashboard />
      <div>
        <Eyebrow>O painel, ao vivo</Eyebrow>
        <Title>O caixa de cada mês, sem conta de cabeça.</Title>
        <ul className="mt-6 space-y-3 text-base md:text-lg">
          {[
            "Entradas ao lado da despesa total, mês a mês.",
            "O resultado de cada mês com seta e sinal: ▲ positivo, ▼ negativo.",
            "Clique em um mês para ver o detalhe dele.",
            "Meses futuros mostram só o que já está comprometido.",
          ].map((t) => (
            <li key={t} className="flex items-start gap-3">
              <Check size={18} className="mt-1 shrink-0 text-good" />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-muted-foreground">Dados fictícios de demonstração.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 7. previsão
function Forecast() {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <Eyebrow>Previsão</Eyebrow>
        <Title>Ver o mês que vem antes dele chegar.</Title>
        <Lead>
          A previsão soma as contas fixas cadastradas com as parcelas que já estão
          lançadas nos cartões. É o que está comprometido, sem chute.
        </Lead>
        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
          <Sparkles size={16} className="mt-0.5 shrink-0" />
          Meses já fechados usam os lançamentos reais, que já incluem as contas fixas. As contas
          cadastradas só entram nos meses futuros, para nunca contar em dobro.
        </div>
      </div>
      <div className="rounded-3xl border bg-card p-6 md:p-8">
        <p className="mb-5 text-sm font-semibold">Comprometido nos próximos meses</p>
        <MiniForecast />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 8. categorias que aprendem
function Learning() {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="order-2 rounded-3xl border bg-card p-6 md:p-8 lg:order-1">
        <p className="mb-5 text-sm font-semibold">Corrigiu uma vez, vale para sempre</p>
        <MiniLearning />
      </div>
      <div className="order-1 lg:order-2">
        <Eyebrow>Categorias que aprendem</Eyebrow>
        <Title>O banco chama tudo de “compras”. A sua empresa, não.</Title>
        <Lead>
          Organizamos cada gasto por fornecedor, com as categorias da sua empresa. Se algo cair no
          lugar errado, você corrige uma vez e a regra vale para todos os lançamentos daquele
          fornecedor, hoje e no futuro.
        </Lead>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 9. construção assistida
function Process() {
  const steps = [
    ["Diagnóstico", "Entendemos o caixa e as rotinas que mais pesam."],
    ["Conexão", "O responsável autoriza os bancos pelo Open Finance."],
    ["Modelagem", "Regras, categorias, contas e alertas do seu jeito."],
    ["Produção", "Painel no ar e treinamento da equipe."],
    ["Revisão mensal", "Ajustamos o sistema ao que mudou no mês."],
  ];
  return (
    <div>
      <Eyebrow>Construção assistida</Eyebrow>
      <Title>
        Cada cliente é construído <Mark>junto</Mark>, passo a passo.
      </Title>
      <Lead>Não é um aplicativo de prateleira nem um robô de implantação: é um trabalho feito com o seu financeiro.</Lead>
      <ol className="mt-10 grid gap-3 md:grid-cols-5">
        {steps.map(([t, d], i) => (
          <li key={t} className="relative rounded-3xl border bg-card p-5">
            <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {i + 1}
            </span>
            <h3 className="font-semibold">{t}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{d}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------- 10. segurança e acesso por código
function Security() {
  const items = [
    { Icon: ShieldCheck, t: "Consentimento oficial", d: "Open Finance regulado pelo Banco Central. Você autoriza no banco e revoga quando quiser." },
    { Icon: EyeOff, t: "Somente leitura", d: "Consulta saldos e lançamentos. Não movimenta dinheiro nem pede senha de banco." },
    { Icon: Building2, t: "Dados separados", d: "Cada empresa tem os seus dados isolados, no próprio banco de dados." },
    { Icon: Scale, t: "LGPD no contrato", d: "Cláusulas de proteção de dados, registro de consentimento e exclusão sob pedido." },
  ];
  return (
    <div>
      <Eyebrow>Segurança e acesso</Eyebrow>
      <Title>Os seus dados financeiros, com o cuidado que merecem.</Title>
      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map(({ Icon, t, d }) => (
            <div key={t} className="rounded-3xl border bg-card p-5">
              <span className={cn(iconBox, "mb-3")}>
                <Icon size={20} />
              </span>
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col rounded-3xl border-2 border-primary bg-primary/10 p-6">
          <span className={cn(iconBox, "mb-4 bg-primary")}>
            <KeyRound size={20} className="text-primary-foreground" />
          </span>
          <h3 className="text-xl font-semibold">Entrada por código de acesso</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Cada pessoa recebe um código pessoal e entra direto no painel da própria empresa.
          </p>
          <div className="my-4 rounded-2xl border bg-card px-4 py-3 text-center font-mono text-sm font-semibold tracking-wider">
            FLX-K7M2-····-····-····
          </div>
          <ul className="space-y-2 text-sm">
            {[
              "Sem senha para esquecer",
              "Revogável na hora",
              "Validade opcional",
              "Leitura ou edição, por pessoa",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Lock size={13} className="shrink-0 text-good" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 11. modelo comercial
function Commercial() {
  const cols = [
    {
      t: "Implantação",
      s: "uma vez",
      items: ["Diagnóstico das rotinas", "Conexão dos bancos", "Modelagem das regras e relatórios", "Treinamento da equipe"],
    },
    {
      t: "Mensalidade",
      s: "recorrente",
      items: ["Hospedagem e segurança", "Sincronização dos bancos", "Ajustes de regras e relatórios", "Suporte", "Revisão mensal dos números"],
    },
  ];
  return (
    <div>
      <Eyebrow>Como contratar</Eyebrow>
      <Title>Implantação única e mensalidade simples.</Title>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {cols.map((c) => (
          <div key={c.t} className="rounded-3xl border bg-card p-7">
            <div className="mb-5 flex items-baseline gap-3">
              <h3 className="text-2xl font-semibold">{c.t}</h3>
              <span className="rounded-full bg-primary/25 px-3 py-1 text-xs font-semibold">{c.s}</span>
            </div>
            <ul className="space-y-3">
              {c.items.map((i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check size={17} className="mt-1 shrink-0 text-good" /> {i}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-6 text-muted-foreground">
        Escopo e valores vêm numa proposta de uma página, depois do diagnóstico.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- 12. antes e depois
function BeforeAfter() {
  const rows: [string, string][] = [
    ["Extratos juntados à mão", "Todos os bancos num só painel"],
    ["Números de ontem, ou da semana passada", "Números atualizados"],
    ["Surpresa com parcelas e vencimentos", "Meses seguintes previstos"],
    ["Regras na cabeça de alguém", "Regras dentro do sistema"],
    ["Relatório montado toda vez", "Relatório no formato da diretoria"],
  ];
  return (
    <div>
      <Eyebrow>O resultado</Eyebrow>
      <Title>Do improviso à rotina organizada.</Title>
      <div className="mt-10 grid gap-3">
        {rows.map(([a, b]) => (
          <div key={a} className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-2xl border bg-card px-5 py-4 text-muted-foreground line-through decoration-muted-foreground/40">
              {a}
            </div>
            <ArrowRight className="mx-auto hidden text-muted-foreground md:block" />
            <div className="rounded-2xl border border-primary/50 bg-primary/15 px-5 py-4 font-medium">
              {b}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 13. próximo passo
function Next() {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <BrandMark className="mx-auto mb-8 w-fit" />
      <Title size="xl">
        Vamos olhar o caixa da sua empresa <Mark>juntos</Mark>.
      </Title>
      <Lead>
        Em 30 a 45 minutos de diagnóstico gratuito mostramos como o painel ficaria com os processos do
        seu financeiro.
      </Lead>
      <ul className="mx-auto mt-8 flex max-w-xl flex-col gap-2 text-left text-base md:text-lg">
        {[
          "Conversa sobre as rotinas que mais pesam hoje",
          "Verificação dos seus bancos no Open Finance",
          "Proposta em uma página, se fizer sentido",
        ].map((t) => (
          <li key={t} className="flex items-center gap-3">
            <Workflow size={18} className="shrink-0 text-good" /> {t}
          </li>
        ))}
      </ul>
      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <CtaLink href="/lp#diagnostico" className="print:hidden">
          Agendar diagnóstico gratuito <ArrowRight size={18} />
        </CtaLink>
      </div>
    </div>
  );
}

export const SLIDES: Slide[] = [
  { id: "capa", title: "Capa", node: <Cover /> },
  { id: "problema", title: "O problema", node: <Problem /> },
  { id: "pronto", title: "Por que o sistema pronto não basta", node: <Versus /> },
  { id: "ideia", title: "A ideia", node: <Idea /> },
  { id: "personaliza", title: "O que se personaliza", node: <Customizable /> },
  { id: "painel", title: "O painel, ao vivo", node: <Panel /> },
  { id: "previsao", title: "Previsão", node: <Forecast /> },
  { id: "categorias", title: "Categorias que aprendem", node: <Learning /> },
  { id: "construcao", title: "Construção assistida", node: <Process /> },
  { id: "seguranca", title: "Segurança e acesso por código", node: <Security /> },
  { id: "contratar", title: "Como contratar", node: <Commercial /> },
  { id: "resultado", title: "O resultado", node: <BeforeAfter /> },
  { id: "proximo", title: "Próximo passo", node: <Next /> },
];
