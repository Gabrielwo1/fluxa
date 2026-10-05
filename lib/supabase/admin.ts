import { createClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/tenant";
import { SUPABASE_URL } from "./config";

// Chave de serviço: ignora o RLS. Só no servidor, nunca em código que vá ao navegador.
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !SUPABASE_URL) {
    throw new HttpError(503, "Acesso por código indisponível: SUPABASE_SERVICE_ROLE_KEY não configurada");
  }
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// E-mail técnico do usuário do código. Precisa ser de uma caixa que você controla
// (ACCESS_EMAIL_BASE=voce@dominio.com): o "+fx-xxxx" cai na mesma caixa e nunca é usado.
export function accessEmail(publicId: string): string {
  const base = process.env.ACCESS_EMAIL_BASE ?? "";
  const at = base.lastIndexOf("@");
  if (at < 1) {
    throw new HttpError(503, "Acesso por código indisponível: ACCESS_EMAIL_BASE não configurada");
  }
  return `${base.slice(0, at)}+fx-${publicId}${base.slice(at)}`;
}
