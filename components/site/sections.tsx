import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ExternalLink,
  EyeOff,
  HandCoins,
  KeyRound,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { SUITE } from "@/lib/suite";
import { CtaLink } from "./cta";
import { BrandMark } from "./site-header";
import { LeadForm } from "./lead-form";
import { QuantoSobrou } from "./quanto-sobrou";
import { HeroCard, MiniFlow, MiniMargem, MiniMes, MiniProjecao, MiniReceber } from "./mei-visuals";

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
      {desc && <p className="mt-4 text-base text-muted-foreground md:text-lg">{desc}</p>}
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
        className={`${SECTION} grid items-center gap-14 pb-24 pt-10 md:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-16`}
      >
        <div className="min-w-0 max-w-xl">
          <Eyebrow>Para MEI e pequenos negócios</Eyebrow>
          <h1 className="text-[2.5rem] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-5xl lg:text-[3.4rem]">
            Descubra quanto <Mark>sobrou</Mark> de verdade no seu negócio.
          </h1>
          <p className="mt-5 max-w-lg text-base text-muted-foreground md:text-lg">
            Registrou a venda, o Fluxa baixa o estoque, mostra quem ainda te deve e
            conta quanto sobrou no mês. Feito para quem vende pelo WhatsApp, sem
            planilha e sem complicação.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <CtaLink href="/demo">
              Testar agora, sem cadastro
              <ArrowRight size={18} />
            </CtaLink>
            <CtaLink href="#acesso" variant="outline">
              Quero acesso antecipado
            </CtaLink>
          </div>
          <ul className="mt-8 space-y-2 text-sm text-muted-foreground">
            {[
              "Abre na hora, com uma empresa de exemplo para você mexer à vontade",
              "Funciona no celular",
              "Sem cartão e sem cadastro para testar",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0 text-good" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0">
          <HeroCard />
        </div>
      </div>
    </section>
  );
}

export function Problem() {
  const items = [
    {
      Icon: Wallet,
      title: "O dinheiro da empresa e o seu se misturam",
      text: "Pagou a conta de casa com o caixa do negócio e agora não sabe se teve lucro ou só movimento.",
    },
    {
      Icon: HandCoins,
      title: "Fiado e parcela que ninguém lembra de cobrar",
      text: "Quem te deve, quanto e desde quando mora na memória ou num caderno. Dinheiro seu, parado na mão do cliente.",
    },
    {
      Icon: Boxes,
      title: "Estoque no olho",
      text: "Você vende o que acabou e deixa parado o que não gira. Só descobre na hora de repor.",
    },
    {
      Icon: MessageCircle,
      title: "A venda mora no WhatsApp",
      text: "Pedido anotado no meio da conversa é difícil de somar no fim do mês e fácil de esquecer.",
    },
  ];
  return (
    <section id="problema" className={`${SECTION} scroll-mt-20 py-24`}>
      <SectionHead
        eyebrow="O problema"
        title="Você vende bastante. Mas sabe quanto realmente sobra?"
        desc="A maioria dos pequenos negócios não quebra por falta de venda. Perde dinheiro no que não consegue enxergar."
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
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
    </section>
  );
}

function BentoCard({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-3xl border bg-card p-6">
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
          eyebrow="O que o Fluxa faz"
          title={
            <>
              Você registra. O resto <Mark>se organiza sozinho</Mark>.
            </>
          }
          desc="Vendas, estoque, contas a receber, contas a pagar e caixa conversam entre si. Um passo seu, vários acertos no sistema."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <BentoCard
            title="Vendeu? O estoque baixa sozinho"
            text="Ao confirmar a venda, o produto sai do estoque e as parcelas já ficam em contas a receber."
          >
            <MiniFlow steps={["Venda confirmada", "Estoque baixou 3 unidades", "2 parcelas a receber"]} />
          </BentoCard>
          <BentoCard
            title="Quem te deve e desde quando"
            text="Veja o que vence hoje, o que vence logo e o que já atrasou, para cobrar a tempo."
          >
            <MiniReceber />
          </BentoCard>
          <BentoCard
            title="Quanto sobrou no mês"
            text="Vendas, custo do que vendeu e despesas num resultado claro, com seta e sinal."
          >
            <MiniMes />
          </BentoCard>
          <BentoCard
            title="O caixa dos próximos meses"
            text="Parcelas a receber e contas fixas já lançadas mostram o saldo de cada mês, antes dele chegar."
          >
            <MiniProjecao />
          </BentoCard>
          <BentoCard
            title="Quanto cada produto realmente rende"
            text="Margem de cada item e curva ABC: o que dá lucro e o que só ocupa espaço."
          >
            <MiniMargem />
          </BentoCard>
          <BentoCard
            title="Comprou do fornecedor? Entra tudo certo"
            text="Ao receber a compra, o estoque sobe, o custo do produto atualiza e a conta a pagar nasce junto."
          >
            <MiniFlow steps={["Compra recebida", "Estoque subiu 24 unidades", "Custo do produto atualizado", "Conta a pagar criada"]} />
          </BentoCard>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          E ainda: cadastro de clientes e fornecedores, contas fixas que se repetem todo mês, oito relatórios
          prontos (vendas, margem, curva ABC, clientes, DRE, caixa, inadimplência e estoque) e um botão
          de ajuda em cada tela, em linguagem simples.
        </p>
      </div>
    </section>
  );
}

export function SuiteSection() {
  return (
    <section id="suite" className={`${SECTION} scroll-mt-20 py-24`}>
      <SectionHead
        eyebrow="Mais que um sistema"
        title={
          <>
            Do cliente novo ao <Mark>caixa</Mark>, na mesma casa.
          </>
        }
        desc="O Fluxa faz parte de uma suíte: o gerenciador para fechar a conta, um módulo para achar clientes e outro para atender no WhatsApp."
      />
      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {SUITE.map((m) => {
          const here = m.id === "fluxa";
          return (
            <div key={m.id} className="flex flex-col rounded-3xl border bg-card p-6">
              <div className="mb-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.icon} alt="" className="h-12 w-12 rounded-full" />
                <div>
                  <h3 className="text-lg font-bold leading-tight">{m.name}</h3>
                  <p className="text-xs text-muted-foreground">{m.tagline}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{m.description}</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {m.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              {m.soon && (
                <div className="mt-4 rounded-2xl border border-dashed p-3">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Sparkles size={12} /> Em breve
                  </p>
                  <ul className="space-y-1 text-sm">
                    {m.soon.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-auto pt-5">
                {here ? (
                  <span className="inline-flex rounded-full bg-primary/25 px-3 py-1.5 text-sm font-semibold">
                    Este é o sistema desta página
                  </span>
                ) : (
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-full border bg-background px-5 text-sm font-semibold hover:bg-muted"
                  >
                    Abrir {m.name} <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Na demonstração você vê também a prévia da prospecção e do atendimento com IA. As integrações
        entre os três módulos estão em desenvolvimento.
      </p>
    </section>
  );
}

export function ProcessSteps() {
  const steps = [
    {
      t: "Abra a demonstração",
      d: "Um clique e você entra numa empresa de exemplo, com clientes, vendas, estoque e contas já preenchidos. Sem cadastro.",
    },
    {
      t: "Mexa em tudo",
      d: "Registre uma venda, receba uma parcela, veja o estoque baixar. Os dados são fictícios e somem sozinhos em 24 horas.",
    },
    {
      t: "Peça o seu acesso",
      d: "Gostou? Deixe seu contato abaixo. Liberamos o acesso para você cadastrar o seu negócio de verdade.",
    },
  ];
  return (
    <section id="como-funciona" className="scroll-mt-20 border-y bg-muted/40 py-24">
      <div className={SECTION}>
        <SectionHead eyebrow="Como começar" title="Teste antes de decidir. Em três passos." center />
        <ol className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.t} className="rounded-3xl border bg-card p-6">
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {i + 1}
              </span>
              <h3 className="text-lg font-semibold">{s.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex justify-center">
          <CtaLink href="/demo">
            Testar agora, sem cadastro
            <ArrowRight size={18} />
          </CtaLink>
        </div>
      </div>
    </section>
  );
}

export function CalculatorSection() {
  return (
    <section id="calcule" className={`${SECTION} scroll-mt-20 py-24`}>
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
        <SectionHead
          eyebrow="Faça a conta"
          title="Quanto sobrou do seu mês?"
          desc="Mexa nos valores e veja o que sobra no negócio, o que sobra depois da sua retirada e quanto das vendas já foi do limite do MEI. É a conta que o Fluxa faz por você, sozinha, todo mês."
        />
        <QuantoSobrou />
      </div>
    </section>
  );
}

export function Security() {
  const items = [
    {
      Icon: ShieldCheck,
      t: "Dados separados por negócio",
      d: "Cada empresa enxerga só os próprios dados. Nada se mistura com o de outro cliente.",
    },
    {
      Icon: KeyRound,
      t: "Acesso por código pessoal",
      d: "Sem senha para esquecer. Cada pessoa entra com o seu código, e ele pode ser cancelado na hora.",
    },
    {
      Icon: EyeOff,
      t: "Banco conectado é opcional",
      d: "Se quiser, conecte o banco pelo Open Finance, regulado pelo Banco Central. É somente leitura: o Fluxa não movimenta dinheiro.",
    },
  ];
  return (
    <section id="seguranca" className={`${SECTION} scroll-mt-20 py-20`}>
      <SectionHead eyebrow="Segurança" title="Seus números, só seus." center />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
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
    </section>
  );
}

const FAQ = [
  {
    q: "Preciso entender de finanças para usar?",
    a: "Não. As telas usam palavras do dia a dia (“quem me deve”, “quanto sobrou”), cada página tem um botão de ajuda e o início traz um passo a passo para começar.",
  },
  {
    q: "Posso testar sem cadastro?",
    a: "Pode. Em um clique você abre uma empresa de exemplo só sua, com tudo preenchido, e mexe à vontade. Os dados são fictícios e somem sozinhos em 24 horas.",
  },
  {
    q: "Quanto custa?",
    a: "Estamos fechando os planos para MEI e pequenos negócios. Quem pede acesso antecipado fica sabendo o valor primeiro, antes de qualquer cobrança e sem compromisso.",
  },
  {
    q: "O Fluxa emite nota fiscal?",
    a: "O Fluxa tem uma área de notas fiscais para MEI que presta serviço (NFS-e), com a emissão guiada por conversa. Para nota de venda de produtos ainda não: nesse caso, siga usando o emissor do governo ou o do seu contador.",
  },
  {
    q: "Funciona no celular?",
    a: "Sim. Dá para registrar uma venda e conferir o caixa direto do celular.",
  },
  {
    q: "Serve para quem vende pelo WhatsApp?",
    a: "Serve. Você registra a venda em poucos segundos e o estoque e as parcelas se acertam. A venda feita direto na conversa, com baixa automática, está em desenvolvimento.",
  },
  {
    q: "Preciso conectar meu banco?",
    a: "Não. É opcional. Se quiser, a conexão usa o Open Finance, regulado pelo Banco Central, só para leitura de saldos e lançamentos. O Fluxa não movimenta dinheiro nem pede senha de banco.",
  },
  {
    q: "Meus dados ficam seguros?",
    a: "Cada negócio tem os dados separados e entra com um código de acesso pessoal, que pode ser cancelado a qualquer momento. Você pode pedir a exclusão dos seus dados quando quiser.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 border-t bg-muted/40 py-20">
      <div className={SECTION}>
        <SectionHead eyebrow="Perguntas frequentes" title="O que mais nos perguntam." center />
        <div className="mx-auto mt-10 max-w-3xl space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-2xl border bg-card px-5 py-4 open:shadow-sm">
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
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section id="acesso" className="scroll-mt-20 px-5 py-24 md:px-8">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-foreground p-6 text-background md:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/40 blur-3xl"
        />
        <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-background/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest">
              <Sparkles size={13} /> Acesso antecipado
            </p>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight md:text-5xl md:leading-[1.08]">
              Pronto para saber quanto sobrou?
            </h2>
            <p className="mt-4 max-w-lg text-base text-background/70 md:text-lg">
              Teste agora na demonstração, ou deixe seu contato para usar o Fluxa com o seu negócio de verdade.
              Sem compromisso.
            </p>
            <div className="mt-7">
              <a
                href="/demo"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Testar agora, sem cadastro <ArrowRight size={18} />
              </a>
            </div>
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
            Vendas, estoque e caixa do seu negócio, num lugar só.
          </p>
        </div>
        <div className="text-sm text-muted-foreground md:text-right">
          <a href="/demo" className="font-medium text-foreground underline-offset-4 hover:underline">
            Testar agora
          </a>
          <span aria-hidden> · </span>
          <a href="/lp/privacidade" className="font-medium text-foreground underline-offset-4 hover:underline">
            Política de privacidade
          </a>
          <p className="mt-1">© {new Date().getFullYear()} Fluxa. Os dados mostrados nesta página são fictícios.</p>
        </div>
      </div>
    </footer>
  );
}
