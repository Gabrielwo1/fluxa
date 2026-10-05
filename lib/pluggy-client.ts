import type { Tenant } from "@/lib/tenant";
import { credsFor, hasOwnCreds, pluggyFetch, pluggyPost } from "@/lib/pluggy";

// Cliente da Pluggy já com as credenciais do cliente atual.
export function pluggyFor(t: Tenant) {
  const creds = credsFor(t.clientSlug);
  const suffix = t.clientSlug.toUpperCase().replace(/[^A-Z0-9]/g, "_");

  // "item não encontrado" costuma ser conexão feita em outra aplicação da Pluggy
  const explain = (e: unknown): never => {
    if (e instanceof Error && e.message.includes("404") && !hasOwnCreds(t.clientSlug)) {
      throw new Error(
        `${e.message} | Se este cliente conectou os bancos na conta dele do Pluggy Dashboard, ` +
          `defina PLUGGY_CLIENT_ID_${suffix} e PLUGGY_CLIENT_SECRET_${suffix}.`
      );
    }
    throw e;
  };

  return {
    get: <T = unknown>(path: string) => pluggyFetch<T>(path, creds).catch(explain) as Promise<T>,
    post: <T = unknown>(path: string, body?: Record<string, unknown>) =>
      pluggyPost<T>(path, body, creds).catch(explain) as Promise<T>,
  };
}
