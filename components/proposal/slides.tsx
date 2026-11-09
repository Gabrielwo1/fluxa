import {
  AlarmClock,
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  FileSpreadsheet,
  HandCoins,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  MessageCircle,
  Package,
  Receipt,
  Repeat,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  StickyNote,
  Truck,
  Users,
  Wallet,
  Settings,
  LineChart,
  Phone,
} from "lucide-react";
import { BRAND, WHATSAPP } from "@/lib/brand";
import { PROPOSAL, money0 } from "@/lib/proposal";
import { cn } from "@/lib/utils";
import { CtaLink } from "@/components/site/cta";
import type { ProposalSlide } from "@/components/proposal/proposal";
import { MockBank, MockCashflow, MockCustomers, MockDashboard, MockFinance, MockQuote, MockReports, MockSales, MockStock } from "@/components/proposal/mocks";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      {children}
    </p>
  );
}

function H({ children, xl }: { children: React.ReactNode; xl?: boolean }) {
  return <h2 className={cn("font-semibold leading-[1.1] tracking-[-0.03em]", xl ? "text-4xl sm:text-5xl lg:text-6xl" : "text-3xl sm:text-4xl lg:text-5xl")}>{children}</h2>;
}

function Mark({ children }: { children: React.ReactNode }) {
  return <span className="bg-[linear-gradient(transparent_62%,color-mix(in_oklch,var(--primary)_55%,transparent)_62%)] px-0.5 [box-decoration-break:clone]">{children}</span>;
}

const Lead = ({ children }: { children: React.ReactNode }) => <p className="mt-3 max-w-2xl text-base text-muted-foreground md:text-lg">{children}</p>;

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 space-y-2.5">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-3 text-[15px] leading-snug md:text-base">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check size={12} strokeWidth={3} /></span>
          {t}
        </li>
      ))}
    </ul>
  );
}

// texto de um lado, ilustração do outro (empilha no celular, com a ilustração primeiro)
function Split({ children, visual }: { children: React.ReactNode; visual: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-12">
      <div className="order-2 min-w-0 md:order-1">{children}</div>
      <div className="order-1 mx-auto w-full max-w-md min-w-0 md:order-2">{visual}</div>
    </div>
  );
}

const iconBox = "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/25";

const MODULES = [
  { Icon: LayoutDashboard, t: "Painel inicial" },
  { Icon: Users, t: "Clientes" },
  { Icon: ShoppingCart, t: "Vendas e orçamentos" },
  { Icon: Truck, t: "Compras e fornecedores" },
  { Icon: Package, t: "Produtos e serviços" },
  { Icon: Boxes, t: "Estoque" },
  { Icon: HandCoins, t: "Contas a receber" },
  { Icon: Receipt, t: "Contas a pagar" },
  { Icon: Wallet, t: "Caixas e contas" },
  { Icon: LineChart, t: "Fluxo de caixa" },
  { Icon: Repeat, t: "Contas recorrentes" },
  { Icon: BarChart3, t: "Relatórios" },
  { Icon: Landmark, t: "Bancos conectados" },
  { Icon: Settings, t: "Cadastros e ajustes" },
];

export function buildSlides(client?: string): ProposalSlide[] {
  const who = client?.trim().slice(0, 60);
  return [
    {
      id: "capa",
      title: "Capa",
      node: (
        <div>
          <Eyebrow>{who ? `Proposta para ${who}` : "Proposta"}</Eyebrow>
          <H xl>
            Sua empresa inteira, <Mark>num só lugar</Mark>.
          </H>
          <Lead>
            {BRAND.name} reúne clientes, vendas, estoque, financeiro e relatórios em um sistema simples de usar, no celular e no computador.
          </Lead>
          <ul className="mt-6 flex flex-wrap gap-2">
            {["Vendas", "Estoque", "Financeiro", "Relatórios", "Bancos"].map((t) => (
              <li key={t} className="rounded-full border bg-card px-4 py-1.5 text-sm font-medium">{t}</li>
            ))}
          </ul>
          <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><Smartphone size={16} /> Deslize para o lado para ver tudo <ArrowRight size={14} /></p>
        </div>
      ),
    },
    {
      id: "hoje",
      title: "Como é hoje",
      node: (
        <div>
          <Eyebrow>O ponto de partida</Eyebrow>
          <H>Quando cada coisa mora num lugar, o dinheiro some.</H>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              [FileSpreadsheet, "Planilhas que ninguém atualiza", "Cada pessoa com a sua versão e os números nunca batem."],
              [StickyNote, "Caderno e papelzinho", "Venda anotada, fiado esquecido, cliente que deve e ninguém lembra."],
              [MessageCircle, "Combinados no WhatsApp", "Preço, prazo e desconto perdidos no meio da conversa."],
              [AlarmClock, "Descobrir tarde demais", "O estoque acaba e a conta vence sem aviso."],
            ].map(([Icon, t, d]) => {
              const I = Icon as typeof FileSpreadsheet;
              return (
                <div key={t as string} className="flex gap-3 rounded-3xl border bg-card p-4">
                  <span className={iconBox}><I size={20} /></span>
                  <div><p className="font-semibold">{t as string}</p><p className="mt-0.5 text-sm text-muted-foreground">{d as string}</p></div>
                </div>
              );
            })}
          </div>
        </div>
      ),
    },
    {
      id: "visao",
      title: "Tudo num só lugar",
      node: (
        <div>
          <Eyebrow>A solução</Eyebrow>
          <H>Um sistema, <Mark>todos os módulos</Mark> conectados.</H>
          <Lead>Registrou uma venda? O estoque baixa, a cobrança nasce e o painel se atualiza. Sem digitar duas vezes.</Lead>
          <ul className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {MODULES.map(({ Icon, t }) => (
              <li key={t} className="flex items-center gap-2.5 rounded-2xl border bg-card px-3 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/25"><Icon size={16} /></span>
                <span className="text-[13px] font-medium leading-tight md:text-sm">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      id: "painel",
      title: "Painel inicial",
      node: (
        <Split visual={<MockDashboard />}>
          <Eyebrow>Painel inicial</Eyebrow>
          <H>Abriu, entendeu como está o negócio.</H>
          <Lead>Os números que importam e uma lista do que fazer hoje, sem procurar em lugar nenhum.</Lead>
          <Bullets items={["Vendas do mês comparadas com o mês passado", "Quanto tem a receber, a pagar e em caixa", "Avisos: conta atrasada, estoque baixo, orçamento parado", "Gráfico dos últimos 6 meses"]} />
        </Split>
      ),
    },
    {
      id: "clientes",
      title: "Clientes",
      node: (
        <Split visual={<MockCustomers />}>
          <Eyebrow>Clientes e fornecedores</Eyebrow>
          <H>Cada cliente, com a história completa.</H>
          <Lead>Contato, tudo o que já comprou e o que está em aberto, a um toque de distância.</Lead>
          <Bullets items={["Cadastro rápido: busca o endereço pelo CEP e a empresa pelo CNPJ", "Histórico de compras e cobranças de cada cliente", "Leads: quem ainda está negociando", "Chame no WhatsApp direto da ficha"]} />
        </Split>
      ),
    },
    {
      id: "vendas",
      title: "Vendas e orçamentos",
      node: (
        <Split visual={<div className="space-y-4"><div className="hidden md:block"><MockQuote /></div><MockSales /></div>}>
          <Eyebrow>Vendas e orçamentos</Eyebrow>
          <H>Do orçamento ao dinheiro no caixa.</H>
          <Lead>Monte o orçamento, o cliente aprova, você confirma. O resto acontece sozinho.</Lead>
          <Bullets items={["Orçamento vira venda com um toque", "Desconto, parcelamento e forma de pagamento", "Estoque baixa automaticamente", "A cobrança de cada parcela já nasce no financeiro", "Imprima ou envie ao cliente"]} />
        </Split>
      ),
    },
    {
      id: "estoque",
      title: "Estoque e compras",
      node: (
        <Split visual={<MockStock />}>
          <Eyebrow>Produtos, estoque e compras</Eyebrow>
          <H>Saiba o que tem, o que falta e quanto sobra.</H>
          <Lead>O catálogo guarda preço e custo; o sistema calcula sua margem em cada venda.</Lead>
          <Bullets items={["Produtos e serviços com preço, custo e margem", "Estoque se mexe sozinho: venda baixa, compra soma", "Alerta de estoque mínimo antes de faltar", "Compras de fornecedores com contas a pagar automáticas", "Contagem e ajustes com o motivo registrado"]} />
        </Split>
      ),
    },
    {
      id: "financeiro",
      title: "Financeiro",
      node: (
        <Split visual={<MockFinance />}>
          <Eyebrow>Financeiro</Eyebrow>
          <H>Quem deve, quem você deve, e quando.</H>
          <Lead>Contas a receber e a pagar organizadas por vencimento, com destaque no que está atrasado.</Lead>
          <Bullets items={["Dê baixa em um toque: recebeu ou pagou", "Parcelas, juros e desconto no pagamento", "Caixas e contas com saldo sempre atualizado", "Aluguel, mensalidades e contas fixas lançadas com um clique por mês"]} />
        </Split>
      ),
    },
    {
      id: "fluxo",
      title: "Fluxo de caixa",
      node: (
        <Split visual={<MockCashflow />}>
          <Eyebrow>Fluxo de caixa</Eyebrow>
          <H>Veja o aperto <Mark>antes</Mark> de ele chegar.</H>
          <Lead>O sistema projeta seu saldo para os próximos 30, 60 ou 90 dias com base no que vai entrar e sair.</Lead>
          <Bullets items={["Saldo previsto dia a dia e semana a semana", "Aviso quando o saldo ficar negativo, com a data", "Tempo de negociar prazo ou antecipar recebimentos"]} />
        </Split>
      ),
    },
    {
      id: "relatorios",
      title: "Relatórios",
      node: (
        <Split visual={<MockReports />}>
          <Eyebrow>Relatórios</Eyebrow>
          <H>Respostas prontas, sem montar planilha.</H>
          <Lead>Oito relatórios para as perguntas de quem toca o negócio. Escolha o período e pronto.</Lead>
          <Bullets items={["Quanto vendi, por mês, cliente ou produto", "Onde está a margem e quais produtos mais rendem (curva ABC)", "Resultado do período (DRE) e entradas e saídas reais", "Quem está em atraso e há quantos dias", "Baixe em planilha ou imprima"]} />
        </Split>
      ),
    },
    {
      id: "bancos",
      title: "Bancos conectados",
      node: (
        <Split visual={<MockBank />}>
          <Eyebrow>Bancos conectados</Eyebrow>
          <H>Seu banco dentro do sistema.</H>
          <Lead>Pelo Open Finance você enxerga saldo, extrato e investimentos reais ao lado da gestão, sem digitar nada.</Lead>
          <Bullets items={["Conexão somente leitura: o sistema nunca movimenta seu dinheiro", "Extrato e categorias automáticas das despesas", "Saldo real para conferir com o do sistema", "Projeção de rendimento dos investimentos"]} />
        </Split>
      ),
    },
    {
      id: "conexao",
      title: "Tudo conectado",
      node: (
        <div>
          <Eyebrow>Como as peças se encaixam</Eyebrow>
          <H>Um lançamento, <Mark>vários efeitos</Mark>.</H>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              { t: "Quando você vende", steps: ["Cliente", "Venda confirmada", "Estoque baixa", "Conta a receber", "Caixa sobe"] },
              { t: "Quando você compra", steps: ["Fornecedor", "Compra recebida", "Estoque sobe", "Conta a pagar", "Caixa desce"] },
            ].map((f) => (
              <div key={f.t} className="rounded-3xl border bg-card p-5">
                <p className="mb-4 font-semibold">{f.t}</p>
                <ol>
                  {f.steps.map((s, i) => (
                    <li key={s} className="relative flex items-center gap-3 pb-3 last:pb-0">
                      {i < f.steps.length - 1 && <span aria-hidden className="absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-px bg-border" />}
                      <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                      <span className="text-sm font-medium">{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "facil",
      title: "Fácil e seguro",
      node: (
        <div>
          <Eyebrow>Fácil de usar, seguro de guardar</Eyebrow>
          <H>Feito para quem não é do ramo de sistemas.</H>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              [Smartphone, "Funciona no celular", "Venda, cobre e consulte de qualquer lugar, sem instalar nada."],
              [LifeBuoy, "Ajuda dentro do sistema", "Cada tela explica o que faz, com passo a passo e glossário."],
              [Sparkles, "Dados de exemplo", "Explore com uma empresa fictícia e apague quando quiser."],
              [Lock, "Dados só seus", "Cada empresa tem seus dados separados, com acesso por login."],
              [ShieldCheck, "Banco somente leitura", "A conexão bancária consulta, nunca movimenta."],
              [Phone, "Acompanhamento", "Estamos junto no início para tirar dúvidas."],
            ].map(([Icon, t, d]) => {
              const I = Icon as typeof Lock;
              return (
                <div key={t as string} className="flex gap-3 rounded-3xl border bg-card p-4">
                  <span className={iconBox}><I size={20} /></span>
                  <div><p className="font-semibold">{t as string}</p><p className="mt-0.5 text-sm text-muted-foreground">{d as string}</p></div>
                </div>
              );
            })}
          </div>
        </div>
      ),
    },
    {
      id: "comeco",
      title: "Como começamos",
      node: (
        <div>
          <Eyebrow>Implantação</Eyebrow>
          <H>Em poucos dias você está usando.</H>
          <ol className="mt-6 space-y-3">
            {[
              ["Conversa rápida", "Entendemos como sua empresa funciona hoje."],
              ["Configuração", "Deixamos o sistema com os dados e as contas da sua empresa."],
              ["Cadastros iniciais", "Colocamos seus principais clientes, produtos e saldos."],
              ["Treinamento", "Mostramos o dia a dia, passo a passo, para você e sua equipe."],
              ["Acompanhamento", "Ficamos por perto nas primeiras semanas."],
            ].map(([t, d], i) => (
              <li key={t} className="flex items-start gap-4 rounded-3xl border bg-card p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
                <div><p className="font-semibold">{t}</p><p className="text-sm text-muted-foreground">{d}</p></div>
              </li>
            ))}
          </ol>
        </div>
      ),
    },
    {
      id: "investimento",
      title: "Investimento",
      node: (
        <div>
          <Eyebrow>Investimento</Eyebrow>
          <H>Simples: uma implantação e uma mensalidade.</H>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-3xl border bg-card p-6">
              <p className="text-sm font-semibold text-muted-foreground">Implantação</p>
              <p className="mt-1 text-5xl font-bold tracking-tight tabular-nums">{money0(PROPOSAL.setup)}</p>
              <p className="mt-1 inline-block rounded-full bg-primary/25 px-3 py-1 text-xs font-semibold">pagamento único</p>
              <ul className="mt-5 space-y-2.5">
                {PROPOSAL.setupIncludes.map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-sm"><Check size={16} className="mt-0.5 shrink-0 text-good" /> {t}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border-2 border-primary bg-card p-6 shadow-[0_8px_30px_color-mix(in_oklch,var(--primary)_25%,transparent)]">
              <p className="text-sm font-semibold text-muted-foreground">Mensalidade</p>
              <p className="mt-1 flex items-baseline gap-1.5 text-5xl font-bold tracking-tight tabular-nums">{money0(PROPOSAL.monthly)}<span className="text-lg font-medium text-muted-foreground">/mês</span></p>
              <p className="mt-1 inline-block rounded-full bg-primary/25 px-3 py-1 text-xs font-semibold">todos os módulos</p>
              <ul className="mt-5 space-y-2.5">
                {PROPOSAL.monthlyIncludes.map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-sm"><Check size={16} className="mt-0.5 shrink-0 text-good" /> {t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "fechamento",
      title: "Vamos começar",
      node: (
        <div className="text-center md:text-left">
          <Eyebrow>Próximo passo</Eyebrow>
          <H xl>
            {who ? <>Vamos colocar a <Mark>{who}</Mark> no ar?</> : <>Vamos <Mark>começar</Mark>?</>}
          </H>
          <Lead>Em uma conversa de poucos minutos combinamos a data, e você já sai usando.</Lead>
          <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center md:justify-start">
            {WHATSAPP ? (
              <CtaLink href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Olá! Vi a proposta do ${BRAND.name}${who ? ` para ${who}` : ""} e quero começar.`)}`} className="justify-center">
                <MessageCircle size={18} /> Quero começar
              </CtaLink>
            ) : (
              <CtaLink href="/lp#contato" className="justify-center">Quero começar <ArrowRight size={18} /></CtaLink>
            )}
            <CtaLink href="#3" variant="outline" className="justify-center">Rever os módulos</CtaLink>
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            {money0(PROPOSAL.setup)} de implantação (uma vez) e {money0(PROPOSAL.monthly)} por mês, com todos os módulos.
          </p>
        </div>
      ),
    },
  ];
}
