import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/sections";

export const metadata: Metadata = {
  title: `Política de privacidade | ${BRAND.name}`,
  robots: { index: false },
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-14 md:px-8">
        <p className="mb-6 rounded-2xl border border-dashed bg-primary/20 p-4 text-sm font-medium">
          Rascunho. Este texto precisa ser revisado por um advogado antes de a
          página ir ao ar com anúncios.
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Política de privacidade</h1>
        <div className="mt-6 space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">Quais dados coletamos</h2>
            <p>
              No formulário de diagnóstico: nome, cargo, e-mail corporativo,
              telefone, empresa, faixa de faturamento e o texto que você
              escrever. Também guardamos os parâmetros de campanha da URL
              (utm) para saber de qual anúncio você veio.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">Para que usamos</h2>
            <p>
              Para entrar em contato sobre o diagnóstico gratuito e, se fizer
              sentido, enviar uma proposta. Não vendemos nem compartilhamos
              esses dados com terceiros para publicidade.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">Por quanto tempo guardamos</h2>
            <p>
              Pelo tempo necessário para o contato comercial. Você pode pedir a
              exclusão a qualquer momento.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">Seus direitos</h2>
            <p>
              Pela LGPD, você pode pedir acesso, correção, exclusão e
              informações sobre o tratamento dos seus dados. Responsável e
              canal de contato: a preencher antes de publicar.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
