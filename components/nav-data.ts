import {
  BarChart3,
  Boxes,
  CreditCard,
  Factory,
  FileCheck,
  HandCoins,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  LineChart,
  Package,
  Plug,
  Receipt,
  Repeat,
  Settings,
  Spline,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  ArrowLeftRight,
} from "lucide-react";

export type NavItem = { href: string; label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }> };
export type NavGroup = { label: string | null; items: NavItem[] };

// Menu do ERP: do dia a dia (vender, comprar, receber) até a análise. Os bancos conectados
// (Open Finance) ficam num grupo próprio, porque são uma fonte extra de dados, não o centro.
export const NAV_GROUPS: NavGroup[] = [
  { label: null, items: [{ href: "/", label: "Início", Icon: LayoutDashboard }] },
  {
    label: "Vendas",
    items: [
      { href: "/vendas", label: "Vendas e orçamentos", Icon: ShoppingCart },
      { href: "/clientes", label: "Clientes", Icon: Users },
    ],
  },
  {
    label: "Compras e estoque",
    items: [
      { href: "/compras", label: "Compras", Icon: Truck },
      { href: "/fornecedores", label: "Fornecedores", Icon: Factory },
      { href: "/produtos", label: "Produtos e serviços", Icon: Package },
      { href: "/estoque", label: "Estoque", Icon: Boxes },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { href: "/receber", label: "A receber", Icon: HandCoins },
      { href: "/pagar", label: "A pagar", Icon: Receipt },
      { href: "/fluxo-de-caixa", label: "Fluxo de caixa", Icon: LineChart },
      { href: "/caixas", label: "Caixas e contas", Icon: Wallet },
      { href: "/recorrencias", label: "Recorrências", Icon: Repeat },
    ],
  },
  {
    label: "Análises e fiscal",
    items: [
      { href: "/relatorios", label: "Relatórios", Icon: BarChart3 },
      { href: "/notas-fiscais", label: "Notas fiscais (MEI)", Icon: FileCheck },
      { href: "/conciliacao", label: "Conciliação", Icon: Spline },
    ],
  },
  {
    label: "Bancos (Open Finance)",
    items: [
      { href: "/bancos", label: "Painel bancário", Icon: Landmark },
      { href: "/transacoes", label: "Transações", Icon: ArrowLeftRight },
      { href: "/contas", label: "Contas conectadas", Icon: Wallet },
      { href: "/investimentos", label: "Investimentos", Icon: TrendingUp },
      { href: "/contas-fixas", label: "Contas fixas e previsão", Icon: Receipt },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/integracoes", label: "Integrações", Icon: Plug },
      { href: "/configuracoes", label: "Configurações", Icon: Settings },
      { href: "/assinatura", label: "Assinatura", Icon: CreditCard },
      { href: "/modulos", label: "Módulos da suíte", Icon: LayoutGrid },
      { href: "/ajuda", label: "Ajuda e primeiros passos", Icon: LifeBuoy },
    ],
  },
];

