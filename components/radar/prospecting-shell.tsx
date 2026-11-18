"use client";

import { ErpGate } from "@/components/erp/gate";
import { PageHeader } from "@/components/erp/ui";
import { ProspectingPage } from "@/components/radar/prospecting-page";

// Prospecção de verdade: usa a base da Receita (API do Radar) com o login do Fluxa.
export function ProspectingShell() {
  return (
    <ErpGate>
      {(status) => (
        <>
          <PageHeader
            title="Prospecção"
            description="Encontre empresas que compram o que você vende, direto da base aberta da Receita Federal, e leve para o seu cadastro com um clique."
            help={
              <p>
                A busca usa a mesma base do Radar Empresas, dentro do Fluxa e com o mesmo login. Quando uma empresa já está no seu cadastro, ela aparece marcada como
                cliente ou lead, e os segmentos dos seus clientes viram atalhos para achar empresas parecidas.
              </p>
            }
          />
          <ProspectingPage canWrite={status.canWrite} />
        </>
      )}
    </ErpGate>
  );
}
