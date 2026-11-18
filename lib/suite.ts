// A suíte da Syntax: três produtos, cada um no seu endereço, conectados por este menu.
// Os endereços podem ser trocados por variável de ambiente (ex.: quando houver domínio próprio).
export type SuiteModule = {
  id: "fluxa" | "radar" | "atendente";
  name: string;
  /** versão curta, para o menu no celular */
  short: string;
  tagline: string;
  description: string;
  url: string;
  icon: string;
  features: string[];
  soon?: string[];
};

export const SUITE: SuiteModule[] = [
  {
    id: "fluxa",
    name: "Gerenciador",
    short: "Gerenciador",
    tagline: "ERP e financeiro",
    description: "Clientes, vendas, estoque, contas a pagar e receber, notas do MEI e relatórios num lugar só.",
    url: "/",
    icon: "/suite/fluxa.svg",
    features: ["Vendas e orçamentos", "Estoque e compras", "Financeiro e fluxo de caixa", "Notas fiscais do MEI"],
    soon: ["Cadastro de estoque por foto", "Venda pelo WhatsApp com baixa automática"],
  },
  {
    id: "radar",
    name: "Radar Empresas",
    short: "Radar",
    tagline: "Prospecção de empresas",
    description: "Encontre empresas que compram de você por cidade, segmento e porte, com a base aberta da Receita Federal.",
    url: process.env.NEXT_PUBLIC_RADAR_URL ?? "https://www.b2bradar.pro",
    icon: "/suite/radar-b2b.svg",
    features: ["Busca por CNAE, cidade e porte", "Mapa de calor", "CRM de leads", "Exportação para planilha"],
    soon: ["Prospecção automática a partir dos produtos do ERP"],
  },
  {
    id: "atendente",
    name: "IA WhatsApp",
    short: "WhatsApp",
    tagline: "IA no WhatsApp",
    description: "Atendimento com inteligência artificial no WhatsApp: responde clientes, registra conversas e avisa a equipe.",
    url: process.env.NEXT_PUBLIC_ATENDENTE_URL ?? "https://atendente-syntax.vercel.app",
    icon: "/suite/ia-whatsapp.svg",
    features: ["Resposta automática 24h", "Registro de conversas e vendas", "Avisos para o gerente", "Painel por cliente"],
    soon: ["Consulta de preço e estoque do ERP", "Criação de pedidos direto no Fluxa"],
  },
];
