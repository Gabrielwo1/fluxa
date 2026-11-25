// Credenciais de cada empresa para buscar dados nas origens. Todas só no servidor, uma variável por empresa
// (sufixo = slug em maiúsculas, como MVP_ACCESS_CODE_<SLUG>). Veja docs/INTEGRACOES.md.
const suffix = (slug: string) => slug.toUpperCase().replace(/[^A-Z0-9]/g, "_");
const slugOf = (suf: string) => suf.toLowerCase().replace(/_/g, "-");
const env = (name: string, slug: string) => process.env[`${name}_${suffix(slug)}`]?.trim() || "";

export type AtendenteConfig = { url: string; code: string; slug: string };
export type LojaConfig = {
  shopDomain: string;
  clientId: string;
  clientSecret: string;
  apiVersion: string;
  // banco onde a loja guarda os acessos (loja_eventos); sem ele só vêm os pedidos
  metricsUrl: string;
  metricsKey: string;
};

export type SyncConfig = { atendente: AtendenteConfig | null; loja: LojaConfig | null };

export function syncConfig(tenant: string): SyncConfig {
  const url = env("ATENDENTE_URL", tenant).replace(/\/$/, "");
  const code = env("ATENDENTE_CODE", tenant);
  const domain = env("SHOPIFY_DOMAIN", tenant);
  const clientId = env("SHOPIFY_CLIENT_ID", tenant);
  const clientSecret = env("SHOPIFY_CLIENT_SECRET", tenant);
  return {
    atendente: url && code ? { url, code, slug: env("ATENDENTE_SLUG", tenant) || "veipar" } : null,
    loja:
      domain && clientId && clientSecret
        ? {
            shopDomain: domain,
            clientId,
            clientSecret,
            apiVersion: process.env.SHOPIFY_API_VERSION || "2026-10",
            metricsUrl: env("LOJA_SUPABASE_URL", tenant).replace(/\/$/, ""),
            metricsKey: env("LOJA_SUPABASE_KEY", tenant),
          }
        : null,
  };
}

// Empresas que têm pelo menos uma origem configurada (é quem o agendador sincroniza).
export function syncTenants(): string[] {
  const found = new Set<string>();
  for (const [name, value] of Object.entries(process.env)) {
    const m = /^(ATENDENTE_URL|SHOPIFY_DOMAIN)_(.+)$/.exec(name);
    if (m && value) found.add(slugOf(m[2]));
  }
  return [...found].filter((t) => syncConfig(t).atendente || syncConfig(t).loja);
}
