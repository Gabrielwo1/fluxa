// Páginas do painel que podem ser destino depois do login. Qualquer outro
// caminho (link antigo, digitado errado, endereço de outro ambiente) cai no início,
// em vez de levar o cliente a uma página 404 logo depois de entrar.
const APP_ROUTES = [
  "/clientes",
  "/fornecedores",
  "/produtos",
  "/estoque",
  "/vendas",
  "/compras",
  "/receber",
  "/pagar",
  "/fluxo-de-caixa",
  "/caixas",
  "/recorrencias",
  "/relatorios",
  "/buscar",
  "/configuracoes",
  "/ajuda",
  "/bancos",
  "/transacoes",
  "/contas",
  "/investimentos",
  "/contas-fixas",
  "/notas",
  "/emitir",
  "/fiscal",
  "/acessos",
];

export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  const path = value.split(/[?#]/)[0].replace(/(.)\/+$/, "$1");
  if (path === "/") return value;
  return APP_ROUTES.some((r) => path === r || path.startsWith(`${r}/`)) ? value : "/";
}
