// Valores e textos comerciais da proposta (página /proposta). Para mudar preço ou o que está
// incluso, basta editar aqui.
export const PROPOSAL = {
  setup: 650, // implantação, pagamento único
  monthly: 390, // mensalidade
  setupIncludes: [
    "Configuração da sua empresa no sistema",
    "Cadastro inicial de clientes, produtos e contas",
    "Conexão dos seus bancos pelo Open Finance (se quiser)",
    "Treinamento para você e sua equipe",
  ],
  monthlyIncludes: [
    "Todos os módulos liberados",
    "Hospedagem e segurança dos dados",
    "Atualizações e melhorias do sistema",
    "Suporte para tirar dúvidas",
  ],
} as const;

export const money0 = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
