"use client";

import Link from "next/link";
import { ArrowRight, Boxes, HandCoins, Package, Receipt, ShoppingCart, Truck, Users, Wallet } from "lucide-react";
import { Panel } from "@/components/ui-kit";
import { PageHeader } from "@/components/erp/ui";
import { FAQ, GLOSSARY } from "@/lib/erp/help-content";

const FLOWS = [
  {
    title: "Quando você vende",
    steps: [
      { Icon: Users, label: "Cliente", text: "Quem comprou" },
      { Icon: ShoppingCart, label: "Venda confirmada", text: "Itens e valores" },
      { Icon: Boxes, label: "Estoque baixa", text: "Automático" },
      { Icon: HandCoins, label: "A receber", text: "Uma parcela por vencimento" },
      { Icon: Wallet, label: "Caixa sobe", text: "Quando você dá baixa" },
    ],
  },
  {
    title: "Quando você compra",
    steps: [
      { Icon: Truck, label: "Fornecedor", text: "De quem comprou" },
      { Icon: Package, label: "Compra recebida", text: "Itens e custos" },
      { Icon: Boxes, label: "Estoque sobe", text: "E o custo é atualizado" },
      { Icon: Receipt, label: "A pagar", text: "Uma parcela por vencimento" },
      { Icon: Wallet, label: "Caixa desce", text: "Quando você paga" },
    ],
  },
];

export function HelpPage() {
  return (
    <>
      <PageHeader title="Ajuda e primeiros passos" description="Como as partes do sistema se conectam, o que cada palavra significa e respostas para as dúvidas mais comuns." />

      <Panel className="mb-4">
        <h2 className="mb-1 text-base font-semibold">Por onde começar</h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["1", "Complete os dados da empresa", "/configuracoes", "Configurações"],
            ["2", "Cadastre clientes e fornecedores", "/clientes", "Clientes"],
            ["3", "Cadastre produtos e serviços", "/produtos", "Produtos e serviços"],
            ["4", "Cadastre seus caixas e contas", "/caixas", "Caixas e contas"],
            ["5", "Registre vendas e compras", "/vendas/nova", "Nova venda"],
            ["6", "Acompanhe tudo no Início e nos Relatórios", "/relatorios", "Relatórios"],
          ].map(([n, text, href, label]) => (
            <li key={n} className="flex items-start gap-3 rounded-2xl border p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{n}</span>
              <span className="min-w-0 text-sm"><span className="block font-medium">{text}</span><Link href={href} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">{label} <ArrowRight size={12} /></Link></span>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {FLOWS.map((flow) => (
          <Panel key={flow.title}>
            <h2 className="mb-4 text-base font-semibold">{flow.title}</h2>
            <ol className="space-y-0">
              {flow.steps.map(({ Icon, label, text }, i) => (
                <li key={label} className="relative flex items-center gap-3 pb-4 last:pb-0">
                  {i < flow.steps.length - 1 && <span aria-hidden className="absolute left-[19px] top-10 h-[calc(100%-2.5rem)] w-px bg-border" />}
                  <span className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20"><Icon size={18} /></span>
                  <span><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{text}</span></span>
                </li>
              ))}
            </ol>
          </Panel>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-3 text-base font-semibold">Glossário</h2>
          <dl className="space-y-3">
            {GLOSSARY.map(([t, d]) => (
              <div key={t}><dt className="text-sm font-semibold">{t}</dt><dd className="text-sm text-muted-foreground">{d}</dd></div>
            ))}
          </dl>
        </Panel>
        <Panel>
          <h2 className="mb-3 text-base font-semibold">Dúvidas comuns</h2>
          <div className="space-y-2">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group rounded-2xl border px-4 py-3 open:bg-muted/40">
                <summary className="cursor-pointer text-sm font-medium marker:text-muted-foreground">{q}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
