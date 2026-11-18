import { PROPOSAL } from "@/lib/proposal";

// Preços cobrados no checkout. Ficam no servidor: o valor que vem do navegador nunca é usado.
// Os mesmos números da proposta (lib/proposal.ts); para mudar o preço, mude lá.
export type Kind = "implantacao" | "mensal";

export const PLANS: Record<Kind, { price: number; title: string; installments: number; items: string[] }> = {
  mensal: {
    price: PROPOSAL.monthly,
    title: "Fluxa · mensalidade",
    installments: 1,
    items: [...PROPOSAL.monthlyIncludes, "Cartão renova todo mês · Pix vale 30 dias"],
  },
  implantacao: {
    price: PROPOSAL.setup,
    title: "Fluxa · implantação",
    installments: 12,
    items: [...PROPOSAL.setupIncludes, "Pagamento único, cartão em até 12x ou Pix"],
  },
};

export const isKind = (v: unknown): v is Kind => v === "implantacao" || v === "mensal";
