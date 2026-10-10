// Páginas do painel que podem ser destino depois do login. Qualquer outro
// caminho (link antigo, digitado errado, endereço de outro ambiente) cai no início,
// em vez de levar o cliente a uma página 404 logo depois de entrar.
const APP_ROUTES = ["/", "/contas", "/transacoes", "/investimentos", "/contas-fixas", "/acessos", "/notas", "/emitir", "/fiscal"];

export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  const path = value.split(/[?#]/)[0].replace(/(.)\/+$/, "$1");
  return APP_ROUTES.includes(path) ? value : "/";
}
