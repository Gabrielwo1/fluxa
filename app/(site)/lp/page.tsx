import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { SiteHeader } from "@/components/site/site-header";
import { StickyCta } from "@/components/site/sticky-cta";
import {
  CalculatorSection,
  Custom,
  Faq,
  Features,
  FinalCta,
  Hero,
  Problem,
  ProcessSteps,
  Security,
  SiteFooter,
} from "@/components/site/sections";

export const metadata: Metadata = {
  title: `${BRAND.name} | Sistema financeiro sob medida conectado aos seus bancos`,
  description:
    "Painel financeiro personalizado para empresas, conectado aos bancos via Open Finance. Caixa em tempo real, previsão de meses futuros e rotinas modeladas do seu jeito. Agende um diagnóstico gratuito.",
  openGraph: {
    title: `${BRAND.name} | Seu caixa em tempo real, do jeito do seu financeiro`,
    description:
      "Sistema financeiro sob medida conectado aos bancos via Open Finance. Somente leitura, sem mexer no seu dinheiro.",
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
        <Custom />
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
