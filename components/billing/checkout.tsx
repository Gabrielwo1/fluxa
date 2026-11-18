"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Check, Copy, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ErpGate } from "@/components/erp/gate";
import { Chips, ErrorNote, PageHeader, Tag } from "@/components/erp/ui";
import { Panel } from "@/components/ui-kit";
import { PLANS, type Kind } from "@/lib/billing/plans";
import { useApi } from "@/lib/erp/client";
import { fmtDate, money } from "@/lib/erp/format";

// Checkout transparente do Mercado Pago (Payment Brick): cartão e Pix sem sair do Fluxa.
// O Brick tokeniza o cartão no navegador; o servidor cria o pagamento com o preço do plano.
type Brick = { unmount: () => void };
type MercadoPagoSdk = new (key: string, opts: { locale: string }) => {
  bricks: () => { create: (type: string, el: string, config: Record<string, unknown>) => Promise<Brick> };
};
declare global {
  interface Window {
    MercadoPago?: MercadoPagoSdk;
  }
}

type Status = { configured: boolean; valid_until: string | null; recurring: boolean; active: boolean; setup_paid: boolean };
type Result = { id?: number; status: string; detalhe?: string; error?: string; pix?: { copiaECola: string; qr: string } | null };

export function Checkout() {
  return <ErpGate>{() => <Inner />}</ErpGate>;
}

function Inner() {
  const status = useApi<Status>("/api/billing/status");
  const me = useApi<{ email?: string | null; demo?: boolean }>("/api/me");
  const [kind, setKind] = useState<Kind>("mensal");
  const [sdk, setSdk] = useState(false);
  const [ready, setReady] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const brick = useRef<Brick | null>(null);
  const plan = PLANS[kind];
  const configured = status.data?.configured;
  const demo = me.data?.demo;

  // monta o Brick quando o SDK carrega; remonta ao trocar de plano
  useEffect(() => {
    if (!sdk || !configured || demo || result || !window.MercadoPago) return;
    let cancelled = false;
    const mp = new window.MercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? "", { locale: "pt-BR" });
    mp.bricks()
      .create("payment", "brick-pagamento", {
        initialization: { amount: plan.price, payer: { email: me.data?.email ?? undefined } },
        customization: {
          paymentMethods: {
            creditCard: "all",
            ...(kind === "mensal" ? {} : { debitCard: "all" }),
            bankTransfer: ["pix"],
            maxInstallments: plan.installments,
          },
          visual: { style: { theme: "default", customVariables: { baseColor: "#141518", borderRadiusLarge: "20px", borderRadiusMedium: "14px" } } },
        },
        callbacks: {
          onReady: () => !cancelled && setReady(true),
          onError: (e: unknown) => console.error("Mercado Pago", e),
          onSubmit: async ({ selectedPaymentMethod, formData }: { selectedPaymentMethod: string; formData: Record<string, unknown> }) => {
            const r = await fetch("/api/billing/pay", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ tipo: kind, metodo: selectedPaymentMethod, dados: formData }),
            });
            const body = (await r.json()) as Result & { error?: string };
            if (!r.ok) throw new Error(body.error ?? "Pagamento não concluído");
            setResult(body);
            if (body.status === "approved") status.reload();
          },
        },
      })
      .then((b) => {
        if (cancelled) b.unmount();
        else brick.current = b;
      });
    return () => {
      cancelled = true;
      brick.current?.unmount();
      brick.current = null;
      setReady(false);
    };
    // status.reload e o e-mail não devem remontar o formulário de pagamento
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdk, configured, demo, kind, result]);

  // Pix: consulta a cada 4 s até aprovar
  useEffect(() => {
    if (result?.status !== "pending" || !result.id) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/billing/payments/${result.id}`).then((x) => x.json()).catch(() => null);
      if (r?.status && r.status !== "pending") {
        setResult((a) => (a ? { ...a, status: r.status, detalhe: r.detalhe } : a));
        if (r.status === "approved") status.reload();
      }
    }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.status, result?.id]);

  const s = status.data;

  return (
    <>
      <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" onReady={() => setSdk(true)} />
      <PageHeader title="Assinatura" description="Pague a implantação e a mensalidade do Fluxa com cartão ou Pix, sem sair do sistema." />

      {status.error && <ErrorNote message={status.error} onRetry={status.reload} />}

      {s && (
        <Panel className="mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold">Situação</p>
            {s.active ? <Tag tone="good">Mensalidade em dia até {fmtDate(s.valid_until)}</Tag> : <Tag tone="warn">Mensalidade em aberto</Tag>}
            {s.recurring && <Tag tone="info">Cartão renova todo mês</Tag>}
            {s.setup_paid && <Tag tone="good">Implantação paga</Tag>}
          </div>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <aside className="relative h-fit overflow-hidden rounded-[28px] bg-coal p-7 text-white">
          <span className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-lime/20 blur-[80px]" />
          <div className="relative mb-5">
            <Chips<Kind>
              label="O que pagar"
              value={kind}
              onChange={(k) => {
                setResult(null);
                setKind(k);
              }}
              options={[
                { value: "mensal", label: "Mensalidade" },
                { value: "implantacao", label: "Implantação" },
              ]}
            />
          </div>
          <p className="relative text-sm text-white/55">Você está pagando</p>
          <h2 className="relative mt-1 text-2xl font-semibold tracking-tight">{plan.title}</h2>
          <p className="relative mt-3 text-4xl font-semibold tracking-tight text-lime">
            {money(plan.price)}
            {kind === "mensal" && <span className="text-base text-white/55">/mês</span>}
          </p>
          <ul className="relative mt-6 flex flex-col gap-2.5 text-sm text-white/80">
            {plan.items.map((i) => (
              <li key={i} className="flex items-center gap-2.5">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-lime text-ink">
                  <Check className="size-3" />
                </span>
                {i}
              </li>
            ))}
          </ul>
          <p className="relative mt-8 flex items-center gap-2 text-xs text-white/45">
            <ShieldCheck className="size-4 shrink-0" /> Pagamento processado pelo Mercado Pago. Não guardamos dados do cartão.
          </p>
        </aside>

        <section className="glass rounded-[28px] p-4 sm:p-6">
          {demo && <p className="py-12 text-center text-sm text-muted-foreground">O pagamento não está disponível na demonstração.</p>}
          {!demo && s && !s.configured && (
            <p className="py-12 text-center text-sm text-muted-foreground">O pagamento ainda não foi ligado neste ambiente. Fale com a equipe.</p>
          )}
          {!demo && configured && !result && (
            <>
              {!ready && (
                <div className="flex flex-col items-center gap-3 py-16 text-sm text-muted-foreground">
                  <Loader2 className="size-6 animate-spin" /> Carregando pagamento seguro…
                </div>
              )}
              <div id="brick-pagamento" />
            </>
          )}
          {result && <Outcome result={result} onRetry={() => setResult(null)} />}
        </section>
      </div>
    </>
  );
}

function Outcome({ result, onRetry }: { result: Result; onRetry: () => void }) {
  if (result.status === "approved") {
    return (
      <div className="py-12 text-center">
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-lime text-ink">
          <Check size={26} />
        </span>
        <h3 className="text-xl font-semibold">Pagamento aprovado</h3>
        <p className="mt-1 text-sm text-muted-foreground">Obrigado! Já está tudo liberado.</p>
      </div>
    );
  }
  if (result.status === "pending" && result.pix) {
    return (
      <div className="py-6 text-center">
        <h3 className="text-lg font-semibold">Pague com Pix</h3>
        <p className="mt-1 text-sm text-muted-foreground">Abra o app do seu banco e escaneie o QR Code ou use o copia e cola. A tela atualiza sozinha quando o pagamento cair.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/png;base64,${result.pix.qr}`} alt="QR Code do Pix" className="mx-auto mt-4 size-52 rounded-2xl bg-white p-2" />
        <button
          type="button"
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium hover:bg-muted"
          onClick={() => navigator.clipboard.writeText(result.pix?.copiaECola ?? "").then(() => toast.success("Código Pix copiado."), () => toast.error("Não consegui copiar."))}
        >
          <Copy size={15} /> Copiar código Pix
        </button>
        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={13} className="animate-spin" /> Aguardando o pagamento…
        </p>
      </div>
    );
  }
  return (
    <div className="py-12 text-center">
      <h3 className="text-lg font-semibold">{result.status === "pending" ? "Pagamento em análise" : "Pagamento não aprovado"}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {result.status === "pending" ? "Assim que o banco confirmar, a assinatura é liberada." : "Confira os dados do cartão ou tente outra forma de pagamento."}
      </p>
      {result.status !== "pending" && (
        <button type="button" className="mt-4 inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-coal-2" onClick={onRetry}>
          Tentar de novo
        </button>
      )}
    </div>
  );
}
