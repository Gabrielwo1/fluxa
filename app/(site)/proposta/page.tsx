import type { Metadata } from "next";
import { ProposalPage } from "@/components/proposal/proposal-page";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Proposta ${BRAND.name}`,
  description: "Conheça todos os módulos do sistema e o investimento.",
  robots: { index: false },
};

// ?cliente=Nome personaliza a capa e o fechamento. Ex.: /proposta?cliente=Mercado%20Boa%20Compra
export default async function PropostaPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { cliente } = await searchParams;
  return <ProposalPage client={cliente} />;
}
