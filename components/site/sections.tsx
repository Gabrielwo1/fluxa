import {
  ArrowRight,
  BellRing,
  Building2,
  CalendarClock,
  CheckCircle2,
  EyeOff,
  FileSpreadsheet,
  Lock,
  Scale,
  ShieldCheck,
  Sparkles,
  UserX,
  Workflow,
} from "lucide-react";
import Image from "next/image";
import { BRAND } from "@/lib/brand";
import { CtaLink } from "./cta";
import { DemoDashboard } from "./demo-dashboard";
import { BrandMark } from "./site-header";
import { CustomTabs } from "./custom-tabs";
import { Photo } from "./photo";
import { Calculator } from "./calculator";
import { LeadForm } from "./lead-form";
import {
  MiniAlerts,
  MiniBanks,
  MiniForecast,
  MiniLearning,
  MiniResult,
} from "./mini-visuals";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      {children}
    </p>
  );
}

function SectionHead({
  eyebrow,
  title,
  desc,
  center = false,
}: {
  eyebrow: string;
  title: React.ReactNode;
  desc?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-3xl font-semibold leading-tight tracking-[-0.02em] md:text-[2.6rem] md:leading-[1.1]">
        {title}
      </h2>
      {desc && (
        <p className="mt-4 text-base text-muted-foreground md:text-lg">{desc}</p>
      )}
    </div>
  );
}

function Mark({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-[linear-gradient(transparent_62%,color-mix(in_oklch,var(--primary)_55%,transparent)_62%)] whitespace-nowrap px-0.5 [box-decoration-break:clone]">
      {children}
    </span>
  );
}

const SECTION = "mx-auto max-w-7xl px-5 md:px-8";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(60%_60%_at_85%_0%,color-mix(in_oklch,var(--primary)_32%,transparent),transparent_70%),radial-gradient(40%_50%_at_0%_20%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent_70%)]"
      />
      <div
        className={`${SECTION} grid items-center gap-14 pb-24 pt-10 md:pt-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16`}
      >
        <div className="min-w-0 max-w-xl">
          <Eyebrow>Para empresas de médio e grande porte</Eyebrow>
          <h1 className="text-[2.5rem] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-5xl lg:text-[3.4rem]">
            Seu caixa em <Mark>tempo real</Mark>, do jeito do seu financeiro.
          </h1>
          <p className="mt-5 max-w-lg text-base text-muted-foreground md:text-lg">
            Sistema financeiro sob medida, conectado aos bancos da empresa pelo
            Open Finance. Sem planilha e sem ninguém mexendo no seu dinheiro.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <CtaLink href="#diagnostico">
              Agendar diagnóstico gratuito
              <ArrowRight size={18} />
            </CtaLink>
            <CtaLink href="#solucao" variant="outline">
              Ver o painel por dentro
            </CtaLink>
          </div>
          <ul className="mt-8 space-y-2 text-sm text-muted-foreground">
            {[
              "Open Finance regulado pelo Banco Central",
              "Somente leitura: não movemos dinheiro",
              "Feito sob medida para cada empresa",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0 text-good" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative min-w-0">
          <DemoDashboard reserveBottom />
          <div
            aria-hidden
            className="absolute -right-4 -top-5 hidden animate-[float_6s_ease-in-out_infinite] items-center gap-2.5 rounded-2xl border bg-card px-3.5 py-2.5 text-xs shadow-xl xl:flex"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/30">
              <ShieldCheck size={15} />
            </span>
            <span>
              <span className="block font-semibold">Banco conectado</span>
              <span className="text-muted-foreground">Open Finance · autorizado</span>
            </span>
          </div>
          <div
            aria-hidden
            className="absolute -bottom-5 right-6 hidden animate-[float_7s_ease-in-out_infinite_1s] items-center gap-2.5 rounded-2xl border bg-card px-3.5 py-2.5 text-xs shadow-xl xl:flex"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/30">
              <BellRing size={15} />
            </span>
            <span>
              <span className="block font-semibold">Alerta do mês</span>
              <span className="text-muted-foreground">Despesa 24% acima de ago</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Problem() {
  const items = [
    {
      Icon: FileSpreadsheet,
      title: "Extratos de vários bancos",
      text: "Alguém junta tudo à mão, todo mês. Quando a planilha fica pronta, os números já envelheceram.",
    },
    {
      Icon: UserX,
      title: "Rotina que mora na cabeça de uma pessoa",
      text: "Aprovações, categorias e contas recorrentes dependem de quem sabe de cor. Se essa pessoa sai, o processo vai junto.",
    },
    {
      Icon: CalendarClock,
      title: "Surpresa no fim do mês",
      text: "Parcelas, contas fixas e vencimentos aparecem tarde demais para a diretoria agir.",
    },
  ];
  return (
    <section id="problema" className={`${SECTION} scroll-mt-20 py-24`}>
      <SectionHead
        eyebrow="O problema"
        title="Quando o caixa mora em planilhas, a decisão chega atrasada."
      />
      <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Photo
          src="/lp/problema-planilha.jpg"
          alt="Profissional conferindo relatórios e o notebook com expressão concentrada"
          caption="Conferir extratos à mão, todo mês"
          position="50% 30%"
          className="min-h-[300px] lg:min-h-[420px]"
        />
        <div className="grid gap-4">
          {items.map(({ Icon, title, text }) => (
            <div key={title} className="flex gap-5 rounded-3xl border bg-card p-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/25">
                <Icon size={20} />
              </span>
              <div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BentoCard({
  title,
  text,
  className = "",
  children,
}: {
  title: string;
  text: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col rounded-3xl border bg-card p-6 ${className}`}>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mb-5 mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
      <div className="mt-auto">{children}</div>
    </div>
  );
}

export function Features() {
  return (
    <section id="solucao" className="scroll-mt-20 border-y bg-muted/40 py-20">
      <div className={SECTION}>
        <SectionHead
          eyebrow="A solução"
          title={
            <>
              Um painel que fala a <Mark>língua da sua empresa</Mark>.
            </>
          }
          desc="Todos os bancos, cartões e investimentos num só lugar, sempre atualizados, com os números organizados do jeito que a sua diretoria lê."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-12">
          <BentoCard
            className="lg:col-span-7"
            title="Resultado de cada mês, sem conta de cabeça"
            text="Entradas, despesa total e o saldo do mês: positivo ou negativo, com seta e sinal, na hora."
          >
            <MiniResult />
          </BentoCard>
          <BentoCard
            className="lg:col-span-5"
            title="Previsão dos próximos meses"
            text="Contas fixas e parcelas já comprometidas, mês a mês, para ninguém ser pego de surpresa."
          >
            <MiniForecast />
          </BentoCard>
          <BentoCard
            className="lg:col-span-4"
            title="Todos os bancos, um painel"
            text="Contas, cartões e investimentos consolidados via Open Finance."
          >
            <MiniBanks />
          </BentoCard>
          <BentoCard
            className="lg:col-span-4"
            title="Categorias que aprendem"
            text="O banco classifica tudo como “compras”? Nós organizamos por fornecedor."
          >
            <MiniLearning />
          </BentoCard>
          <BentoCard
            className="lg:col-span-4"
            title="Alertas que você define"
            text="Limites, vencimentos e variações fora do padrão avisam quem precisa saber."
          >
            <MiniAlerts />
          </BentoCard>
        </div>
      </div>
    </section>
  );
}

export function Custom() {
  return (
    <section id="sob-medida" className={`${SECTION} scroll-mt-20 py-24`}>
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <SectionHead
          eyebrow="Sob medida"
          title={
            <>
              O seu processo, <Mark>não o nosso</Mark>.
            </>
          }
          desc="Cada empresa decide as regras. Modelamos as rotinas do seu financeiro dentro do sistema, com você. Estes são exemplos do que fazemos."
        />
        <Photo
          src="/lp/sob-medida-gestores.jpg"
          alt="Três gestores analisando dados financeiros no notebook"
          className="aspect-[16/10]"
          position="50% 40%"
        />
      </div>
      <CustomTabs />
    </section>
  );
}

export function ProcessSteps() {
  const steps = [
    {
      t: "Diagnóstico gratuito",
      d: "Uma conversa de 30 a 45 minutos para entender como o caixa funciona hoje e qual rotina mais pesa.",
    },
    {
      t: "Proposta em uma página",
      d: "Escopo, taxa de implantação e mensalidade, sem letra miúda.",
    },
    {
      t: "Conexão dos bancos",
      d: "O responsável autoriza o acesso pelo fluxo oficial do Open Finance, no próprio banco.",
    },
    {
      t: "Modelagem do seu processo",
      d: "Categorias, regras, contas recorrentes, alertas e relatórios do jeito da empresa.",
    },
    {
      t: "Produção e revisão mensal",
      d: "Treinamento da equipe e uma revisão por mês para ajustar o sistema ao que mudou.",
    },
  ];
  return (
    <section id="como-funciona" className="scroll-mt-20 border-y bg-muted/40 py-24">
      <div className={`${SECTION} grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16`}>
        <div className="min-w-0 lg:sticky lg:top-28 lg:self-start">
          <SectionHead
            eyebrow="Como funciona"
            title="Do primeiro contato ao painel no ar, em cinco passos."
          />
          <Photo
            src="/lp/diagnostico-reuniao.jpg"
            alt="Apresentação de gráficos financeiros em uma sala de reunião"
            caption="O diagnóstico começa numa conversa"
            className="mt-8 aspect-[16/10]"
            position="50% 40%"
          />
        </div>
        <ol className="relative min-w-0 space-y-4">
          <span
            aria-hidden
            className="absolute bottom-6 left-[19px] top-6 w-px bg-border"
          />
          {steps.map((s, i) => (
            <li key={s.t} className="relative flex gap-5">
              <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {i + 1}
              </span>
              <div className="flex-1 rounded-3xl border bg-card p-5">
                <h3 className="font-semibold">{s.t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function CalculatorSection() {
  return (
    <section id="calcule" className={`${SECTION} scroll-mt-20 py-24`}>
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
        <div className="min-w-0">
          <SectionHead
            eyebrow="Faça a conta"
            title="Quanto custa consolidar o caixa à mão?"
            desc="Informe quantas horas por semana o seu time gasta juntando extratos, conciliando e montando relatórios. É uma estimativa simples, com os seus números."
          />
          <Photo
            src="/lp/equipe-relatorios.jpg"
            alt="Equipe diversa analisando relatórios com gráficos"
            className="mt-8 aspect-[16/10]"
            position="50% 35%"
          />
        </div>
        <Calculator />
      </div>
    </section>
  );
}

export function Security() {
  const items = [
    {
      Icon: ShieldCheck,
      t: "Consentimento oficial",
      d: "A conexão usa o Open Finance, regulado pelo Banco Central. Você autoriza no próprio banco e pode revogar quando quiser.",
    },
    {
      Icon: EyeOff,
      t: "Somente leitura",
      d: "O sistema consulta saldos e lançamentos. Não movimenta dinheiro, não paga conta e não pede senha de banco.",
    },
    {
      Icon: Building2,
      t: "Dados separados por cliente",
      d: "Cada empresa tem os seus dados isolados, com acesso por usuário e perfil.",
    },
    {
      Icon: Scale,
      t: "LGPD no contrato",
      d: "Cláusulas de proteção de dados, registro de consentimento e exclusão sob pedido.",
    },
  ];
  return (
    <section id="seguranca" className="scroll-mt-20 border-y bg-muted/40 py-20">
      <div className={SECTION}>
        <SectionHead
          eyebrow="Segurança"
          title="Seus dados financeiros, tratados com o cuidado que merecem."
          center
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ Icon, t, d }) => (
            <div key={t} className="rounded-3xl border bg-card p-6">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/25">
                <Icon size={20} />
              </span>
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <Lock size={14} /> Ainda tem dúvida sobre segurança? A gente explica tudo no diagnóstico.
        </p>
      </div>
    </section>
  );
}

const FAQ = [
  {
    q: "É seguro conectar os bancos da empresa?",
    a: "A conexão usa o Open Finance, regulado pelo Banco Central. Quem autoriza é o responsável da empresa, no próprio banco, e a autorização pode ser revogada a qualquer momento. Nós não vemos nem guardamos senha de banco.",
  },
  {
    q: "Vocês movimentam dinheiro?",
    a: "Não. O sistema só lê saldos e lançamentos. Não faz pagamentos, transferências nem aprova nada nos bancos.",
  },
  {
    q: "Quais bancos funcionam?",
    a: "Os que participam do Open Finance Brasil. Durante o diagnóstico confirmamos banco a banco, inclusive contas empresariais, antes de enviar a proposta.",
  },
  {
    q: "Preciso trocar o ERP ou o sistema que já uso?",
    a: "Não. O painel funciona ao lado do que você já tem e traz uma visão do caixa a partir dos bancos.",
  },
  {
    q: "Como é cobrado?",
    a: "Uma taxa única de implantação mais uma mensalidade, de acordo com o escopo. Você recebe a proposta com os valores depois do diagnóstico.",
  },
  {
    q: "Quanto tempo leva para ficar pronto?",
    a: "Depende do número de bancos e do quanto do seu processo vamos modelar. O prazo fica registrado na proposta.",
  },
  {
    q: "E a LGPD?",
    a: "O contrato traz cláusulas de proteção de dados, os dados de cada cliente ficam separados e a exclusão é feita sob pedido.",
  },
  {
    q: "O diagnóstico tem algum custo?",
    a: "Não. É uma conversa de 30 a 45 minutos para entender o seu caixa. Se fizer sentido, seguimos para a proposta.",
  },
];

export function Faq() {
  return (
    <section id="faq" className={`${SECTION} scroll-mt-20 py-20`}>
      <SectionHead eyebrow="Perguntas frequentes" title="O que mais nos perguntam." center />
      <div className="mx-auto mt-10 max-w-3xl space-y-3">
        {FAQ.map((f) => (
          <details
            key={f.q}
            className="group rounded-2xl border bg-card px-5 py-4 open:shadow-sm"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold [&::-webkit-details-marker]:hidden">
              {f.q}
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-lg leading-none transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section id="diagnostico" className="scroll-mt-20 px-5 pb-24 md:px-8">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-foreground p-6 text-background md:p-12">
        <Image
          src="/lp/executivas.jpg"
          alt=""
          fill
          sizes="(min-width: 1280px) 1280px, 100vw"
          className="object-cover opacity-30 [mask-image:linear-gradient(to_right,black,transparent_58%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/40 blur-3xl"
        />
        <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-background/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest">
              <Sparkles size={13} /> Diagnóstico gratuito
            </p>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight md:text-5xl md:leading-[1.08]">
              Vamos olhar o caixa da sua empresa juntos.
            </h2>
            <p className="mt-4 max-w-lg text-base text-background/70 md:text-lg">
              Em 30 a 45 minutos mostramos como o painel ficaria com os processos
              do seu financeiro. Sem compromisso.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-background/80">
              {[
                "Conversa sobre as rotinas que mais pesam hoje",
                "Verificação dos seus bancos no Open Finance",
                "Proposta em uma página, se fizer sentido",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <Workflow size={15} className="shrink-0 text-primary" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <LeadForm />
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className={`${SECTION} flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between`}>
        <div>
          <BrandMark />
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {BRAND.claim}.
          </p>
        </div>
        <div className="text-sm text-muted-foreground md:text-right">
          <a href="/lp/privacidade" className="font-medium text-foreground underline-offset-4 hover:underline">
            Política de privacidade
          </a>
          <p className="mt-1">
            © {new Date().getFullYear()} {BRAND.name}. Os dados mostrados nesta página são fictícios e as fotos são ilustrativas (
            <a
              href="https://www.freepik.com"
              className="underline underline-offset-2 hover:text-foreground"
              rel="noopener"
            >
              Freepik
            </a>
            ).
          </p>
        </div>
      </div>
    </footer>
  );
}
