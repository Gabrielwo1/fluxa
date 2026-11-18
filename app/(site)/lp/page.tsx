import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { SiteHeader } from "@/components/site/site-header";
import { StickyCta } from "@/components/site/sticky-cta";
import {
  CalculatorSection,
  Faq,
  Features,
  FinalCta,
  Hero,
  Problem,
  ProcessSteps,
  Security,
  SiteFooter,
  SuiteSection,
} from "@/components/site/sections";

export const metadata: Metadata = {
  title: {
    absolute: `${BRAND.name} | Descubra quanto sobrou de verdade no seu negócio`,
  },
  description:
    "Vendas, estoque, contas a receber e caixa num lugar só, feito para MEI e pequenos negócios. Registrou a venda, o estoque baixa e você vê quanto sobrou. Teste agora, sem cadastro.",
  openGraph: {
    title: `${BRAND.name} | Descubra quanto sobrou de verdade no seu negócio`,
    description:
      "Para MEI e pequenos negócios: registre a venda, o estoque baixa e você vê quem te deve e quanto sobrou no mês. Teste sem cadastro.",
    type: "website",
    locale: "pt_BR",
  },
};

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Problem />
        <Features />
        <SuiteSection />
        <ProcessSteps />
        <CalculatorSection />
        <Security />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
      <StickyCta />
    </>
  );
}
