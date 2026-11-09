// Lista dos relatórios disponíveis (nome na URL, título e descrição). Sem código de servidor.
export const REPORTS = [
  { name: "vendas", title: "Vendas", description: "Quanto você vendeu no período, agrupado como preferir.", icon: "ShoppingCart" },
  { name: "margem", title: "Margem por produto", description: "Quanto sobra em cada produto depois do custo.", icon: "Percent" },
  { name: "curva-abc", title: "Curva ABC", description: "Quais poucos produtos geram a maior parte do faturamento.", icon: "BarChart3" },
  { name: "clientes", title: "Ranking de clientes", description: "Quem mais compra, quanto e quando foi a última vez.", icon: "Users" },
  { name: "dre", title: "Resultado do período (DRE)", description: "Vendas, custos, despesas e o que sobrou.", icon: "Scale" },
  { name: "caixa", title: "Entradas e saídas realizadas", description: "O dinheiro que realmente entrou e saiu, por categoria.", icon: "Wallet" },
  { name: "inadimplencia", title: "Contas em atraso", description: "Quem está devendo, há quantos dias e quanto.", icon: "AlarmClock" },
  { name: "estoque", title: "Posição de estoque", description: "Saldo e valor parado no estoque, produto a produto.", icon: "Boxes" },
] as const;

