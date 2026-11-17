// Dados FICTÍCIOS das prévias do Radar B2B e do Atendente Syntax. Nenhum nome ou número é real.

export const PROSPECTS = [
  { nome: "Comercial Horizonte Ltda", cnae: "Comércio varejista de material de escritório", cidade: "Curitiba", uf: "PR", porte: "ME", tel: true, nova: false },
  { nome: "Papelaria Estrela do Sul", cnae: "Comércio varejista de papelaria", cidade: "São José dos Pinhais", uf: "PR", porte: "ME", tel: true, nova: true },
  { nome: "Escritório Contábil Prisma", cnae: "Atividades de contabilidade", cidade: "Curitiba", uf: "PR", porte: "EPP", tel: true, nova: false },
  { nome: "Instituto Aprender Mais", cnae: "Educação infantil e ensino fundamental", cidade: "Pinhais", uf: "PR", porte: "ME", tel: false, nova: true },
  { nome: "Clínica Vida Plena", cnae: "Atividade médica ambulatorial", cidade: "Curitiba", uf: "PR", porte: "EPP", tel: true, nova: false },
  { nome: "Mercadinho Bom Preço", cnae: "Comércio varejista de mercadorias em geral", cidade: "Colombo", uf: "PR", porte: "ME", tel: true, nova: false },
  { nome: "Studio Bella Forma", cnae: "Atividades de condicionamento físico", cidade: "Curitiba", uf: "PR", porte: "ME", tel: true, nova: true },
  { nome: "Oficina Rota 77", cnae: "Manutenção e reparação de veículos", cidade: "Araucária", uf: "PR", porte: "ME", tel: false, nova: false },
] as const;

export const TOP_CIDADES = [
  { nome: "Curitiba", total: 5840 },
  { nome: "São José dos Pinhais", total: 1960 },
  { nome: "Londrina", total: 1710 },
  { nome: "Maringá", total: 1490 },
  { nome: "Ponta Grossa", total: 1120 },
];

export const ABERTURAS_POR_ANO = [820, 910, 1040, 1230, 1180, 1460, 1390];

// densidade fictícia por estado (0 a 1) para o mapa de calor
export const DENSIDADE_UF: Record<string, number> = {
  SP: 1, MG: 0.7, RJ: 0.62, PR: 0.58, RS: 0.55, SC: 0.5, BA: 0.45, GO: 0.38, PE: 0.36, CE: 0.34, ES: 0.3, DF: 0.3,
  PA: 0.22, MT: 0.2, MS: 0.18, MA: 0.17, AM: 0.15, PB: 0.14, RN: 0.14, AL: 0.12, PI: 0.11, SE: 0.1, TO: 0.08, RO: 0.07, AC: 0.04, AP: 0.04, RR: 0.03,
};

export const ETAPAS = [
  { id: "novo", rotulo: "Novos", cor: "#a3b5c6", fundo: "rgb(163 181 198 / 0.16)" },
  { id: "contato", rotulo: "Em contato", cor: "#b9a7f5", fundo: "rgb(185 167 245 / 0.16)" },
  { id: "qualificado", rotulo: "Qualificados", cor: "#7fd8b1", fundo: "rgb(127 216 177 / 0.16)" },
  { id: "proposta", rotulo: "Proposta", cor: "#f5cf5b", fundo: "rgb(245 207 91 / 0.16)" },
  { id: "negociacao", rotulo: "Negociação", cor: "#f2a97e", fundo: "rgb(242 169 126 / 0.16)" },
  { id: "ganho", rotulo: "Ganhos", cor: "#e3fc3f", fundo: "rgb(227 252 63 / 0.22)" },
] as const;

export const LEADS: { etapa: (typeof ETAPAS)[number]["id"]; nome: string; cidade: string; valor: number; acao?: string }[] = [
  { etapa: "novo", nome: "Papelaria Estrela do Sul", cidade: "São José dos Pinhais", valor: 0 },
  { etapa: "novo", nome: "Instituto Aprender Mais", cidade: "Pinhais", valor: 0 },
  { etapa: "novo", nome: "Mercadinho Bom Preço", cidade: "Colombo", valor: 0 },
  { etapa: "contato", nome: "Comercial Horizonte Ltda", cidade: "Curitiba", valor: 2400, acao: "Ligar hoje" },
  { etapa: "contato", nome: "Oficina Rota 77", cidade: "Araucária", valor: 1800 },
  { etapa: "qualificado", nome: "Escritório Contábil Prisma", cidade: "Curitiba", valor: 3900, acao: "Enviar catálogo" },
  { etapa: "proposta", nome: "Clínica Vida Plena", cidade: "Curitiba", valor: 7200, acao: "Retorno amanhã" },
  { etapa: "negociacao", nome: "Studio Bella Forma", cidade: "Curitiba", valor: 5600, acao: "Fechar quinta" },
  { etapa: "ganho", nome: "Auto Peças Central", cidade: "Curitiba", valor: 4800 },
  { etapa: "ganho", nome: "Escola Pequeno Mundo", cidade: "Pinhais", valor: 3100 },
];

export const FILAS = [
  { key: "balcao", rotulo: "Balcão" },
  { key: "atender", rotulo: "Vendedor atender" },
  { key: "fechando", rotulo: "Fechando venda" },
  { key: "pedido", rotulo: "Pedido realizado" },
  { key: "finalizado", rotulo: "Finalizado" },
] as const;

export type Msg = { de: "cliente" | "ia" | "sistema"; texto: string; hora: string };

export const CONVERSAS: { id: string; nome: string; fila: (typeof FILAS)[number]["key"]; ultima: string; hora: string; ia: boolean; naoLidas: number; msgs: Msg[] }[] = [
  {
    id: "c1", nome: "Marcos Oliveira", fila: "fechando", ultima: "Pode mandar o Pix", hora: "10:42", ia: true, naoLidas: 1,
    msgs: [
      { de: "cliente", texto: "Bom dia! Vocês têm caderno universitário de 200 folhas?", hora: "10:38" },
      { de: "ia", texto: "Bom dia, Marcos! Temos sim: Caderno universitário 200 folhas por R$ 22,90 a unidade, 76 em estoque. Quantos você precisa?", hora: "10:38" },
      { de: "cliente", texto: "Quero 6", hora: "10:40" },
      { de: "ia", texto: "Perfeito! 6 unidades dão R$ 137,40. Posso gerar o pedido e te mandar o Pix?", hora: "10:40" },
      { de: "cliente", texto: "Pode mandar o Pix", hora: "10:42" },
      { de: "sistema", texto: "Pedido #130 criado no Fluxa · 6 un reservadas no estoque", hora: "10:42" },
    ],
  },
  {
    id: "c2", nome: "Fernanda Lima", fila: "atender", ultima: "Quero falar com uma pessoa", hora: "10:15", ia: false, naoLidas: 2,
    msgs: [
      { de: "cliente", texto: "Vocês fazem instalação de rede no escritório?", hora: "10:12" },
      { de: "ia", texto: "Fazemos sim! Para passar um valor certo, nosso técnico precisa conhecer o espaço. Quer que eu chame alguém da equipe?", hora: "10:12" },
      { de: "cliente", texto: "Quero falar com uma pessoa", hora: "10:15" },
      { de: "sistema", texto: "Conversa passada para a equipe · gerente avisado", hora: "10:15" },
    ],
  },
  {
    id: "c3", nome: "Auto Center Rota 66", fila: "pedido", ultima: "Obrigado, recebemos!", hora: "09:50", ia: true, naoLidas: 0,
    msgs: [
      { de: "cliente", texto: "Preciso repor 2 cartuchos de tinta preto", hora: "09:31" },
      { de: "ia", texto: "Claro! Cartucho de tinta preto: R$ 99,00 cada, 4 em estoque. Faço o pedido de 2 (R$ 198,00)?", hora: "09:31" },
      { de: "cliente", texto: "Faz sim", hora: "09:33" },
      { de: "sistema", texto: "Pedido #129 criado e confirmado · estoque baixou 2 un", hora: "09:34" },
      { de: "cliente", texto: "Obrigado, recebemos!", hora: "09:50" },
    ],
  },
  {
    id: "c4", nome: "Studio Bella Forma", fila: "balcao", ultima: "Qual o horário de vocês?", hora: "09:12", ia: true, naoLidas: 0,
    msgs: [
      { de: "cliente", texto: "Qual o horário de vocês?", hora: "09:12" },
      { de: "ia", texto: "Atendemos de segunda a sexta, das 8h às 18h, e aos sábados até meio-dia. Posso ajudar com algum produto ou serviço?", hora: "09:12" },
    ],
  },
];

export const TIMELINE = [3.1, 4.2, 3.8, 5.6, 5.1, 6.9, 6.2, 7.8, 7.1, 9.0, 8.4, 10.2];
