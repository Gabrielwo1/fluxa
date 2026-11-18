// Textos de ajuda: aparecem na página /ajuda e servem de base de conhecimento para o assistente de suporte.
export const GLOSSARY: [string, string][] = [
  ["Orçamento", "Proposta que ainda não fechou. Não mexe em estoque nem em dinheiro. Pode ser editado e depois confirmado."],
  ["Venda confirmada", "Negócio fechado: baixa o estoque e cria as contas a receber. Para desfazer, cancele a venda."],
  ["Conta a receber", "Dinheiro que um cliente ainda vai pagar. Cada parcela tem um vencimento."],
  ["Conta a pagar", "Dinheiro que você ainda vai pagar a um fornecedor ou por uma despesa."],
  ["Dar baixa", "Registrar que a parcela foi paga ou recebida, informando a data e a conta de onde o dinheiro entrou ou saiu."],
  ["Custo e margem", "Custo é o que você paga pelo produto; margem é a parte do preço de venda que sobra depois do custo."],
  ["Estoque mínimo", "Quantidade abaixo da qual o sistema avisa que é hora de repor."],
  ["Recorrência", "Conta que se repete todo mês (aluguel, mensalidade). Cadastre uma vez e lance o mês com um clique."],
  ["Fluxo de caixa", "Projeção do seu saldo para os próximos dias, com base no que vai entrar e sair."],
  ["Regime de caixa x competência", "Caixa conta quando o dinheiro entra ou sai de verdade. Competência conta quando a venda ou a despesa aconteceu. O painel inicial usa caixa; o DRE usa competência."],
  ["Lead", "Cliente em potencial, ainda negociando."],
];

export const FAQ: [string, string][] = [
  ["Errei uma venda. E agora?", "Abra a venda e clique em Cancelar venda. O estoque volta e as parcelas em aberto são canceladas. Se já recebeu alguma parcela, desfaça o recebimento antes (botão de desfazer ao lado da parcela). Depois, registre a venda certa."],
  ["Posso editar uma venda confirmada?", "Não, para manter o histórico confiável. Cancele e refaça, ou use Duplicar para copiar os itens numa venda nova."],
  ["O cliente pagou um valor diferente do combinado.", "Em Receber, informe o valor realmente recebido. O sistema guarda o valor original e o que entrou."],
  ["Vendi algo que não tem no estoque.", "Por padrão o sistema avisa e bloqueia. Se isso faz parte do seu jeito de trabalhar, ligue “Permitir vender sem estoque” em Configurações."],
  ["Onde ficam meus bancos conectados?", "No grupo Bancos (Open Finance), no menu. Lá você conecta as contas e vê extrato, saldo e investimentos reais. Em Caixas e contas você compara o saldo do sistema com o do banco."],
  ["Posso apagar um cliente ou produto?", "Só se nunca foi usado. Quem já tem histórico fica como Inativo: some das listas de venda, mas os relatórios continuam corretos."],
  ["Como começo do zero?", "Siga os Primeiros passos no Início. Se quiser testar antes, carregue os dados de exemplo e apague quando se sentir à vontade."],
];
