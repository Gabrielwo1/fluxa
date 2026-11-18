import { reader } from "@/lib/erp/http";
import { PLANS } from "@/lib/billing/plans";
import { billingConfigured, subscriptionOf } from "@/lib/billing/mercadopago";

// Situação da assinatura da empresa e os preços do checkout.
export const GET = reader(async ({ tenant }) => ({
  configured: billingConfigured(),
  plans: { mensal: PLANS.mensal.price, implantacao: PLANS.implantacao.price },
  ...(await subscriptionOf(tenant)),
}));
