import {
  ArrowLeftRight,
  Building2,
  Car,
  Clapperboard,
  HeartPulse,
  Home,
  MonitorSmartphone,
  Percent,
  ShoppingBag,
  Utensils,
  CircleDollarSign,
  type LucideIcon,
} from "lucide-react";

export type Segment = {
  id: string;
  label: string;
  Icon: LucideIcon;
  tint: string;
  categories: string[];
};

// agrupa as categorias da Pluggy em segmentos de gasto legíveis
export const SEGMENTS: Segment[] = [
  {
    id: "food",
    label: "Alimentação",
    Icon: Utensils,
    tint: "bg-amber-500/15 text-amber-500",
    categories: [
      "Eating out",
      "Food and drinks",
      "Food delivery",
      "Groceries",
      "Bakery",
    ],
  },
  {
    id: "shopping",
    label: "Compras",
    Icon: ShoppingBag,
    tint: "bg-violet-500/15 text-violet-400",
    categories: [
      "Shopping",
      "Online shopping",
      "Clothing",
      "Electronics",
      "Gambling",
    ],
  },
  {
    id: "transport",
    label: "Carro e transporte",
    Icon: Car,
    tint: "bg-rose-500/15 text-rose-400",
    categories: [
      "Automotive",
      "Gas stations",
      "Transportation",
      "Vehicle maintenance",
      "Taxi and ride-hailing",
      "Public transport",
      "Parking",
      "Tolls and in vehicle payment",
    ],
  },
  {
    id: "home",
    label: "Casa e contas",
    Icon: Home,
    tint: "bg-emerald-500/15 text-emerald-500",
    categories: [
      "Housing",
      "Electricity",
      "Internet",
      "Telecommunications",
      "Utilities",
      "Rent",
    ],
  },
  {
    id: "services",
    label: "Serviços e assinaturas",
    Icon: MonitorSmartphone,
    tint: "bg-sky-500/15 text-sky-400",
    categories: ["Services", "Digital services", "Video streaming", "Education"],
  },
  {
    id: "health",
    label: "Saúde e bem-estar",
    Icon: HeartPulse,
    tint: "bg-rose-500/15 text-rose-400",
    categories: [
      "Healthcare",
      "Pharmacy",
      "Wellness",
      "Wellness and fitness",
      "Gyms and fitness centers",
      "Pet supplies and vet",
    ],
  },
  {
    id: "leisure",
    label: "Lazer e viagem",
    Icon: Clapperboard,
    tint: "bg-violet-500/15 text-violet-400",
    categories: [
      "Leisure",
      "Cinema, theater and concerts",
      "Accomodation",
      "Travel",
      "Entertainment",
    ],
  },
  {
    id: "fees",
    label: "Impostos, taxas e seguros",
    Icon: Percent,
    tint: "bg-neutral-500/15 text-neutral-400",
    categories: [
      "Bank fees",
      "Interests charged",
      "Late payment and overdraft costs",
      "Tax on financial operations",
      "Taxes",
      "Insurance",
    ],
  },
  {
    id: "suppliers",
    label: "Fornecedores e empresas",
    Icon: Building2,
    tint: "bg-sky-500/15 text-sky-400",
    categories: ["Supplier payments"],
  },
  {
    id: "transfers",
    label: "Transferências",
    Icon: ArrowLeftRight,
    tint: "bg-sky-500/15 text-sky-400",
    categories: ["Transfers", "Transfer - PIX", "Transfer - Foreign Exchange"],
  },
];

export const OTHER_SEGMENT: Segment = {
  id: "other",
  label: "Outros",
  Icon: CircleDollarSign,
  tint: "bg-neutral-500/15 text-neutral-400",
  categories: [],
};

const BY_CATEGORY = new Map<string, Segment>();
for (const s of SEGMENTS) for (const c of s.categories) BY_CATEGORY.set(c, s);

export function segmentOf(category: string | null | undefined): Segment {
  if (!category) return OTHER_SEGMENT;
  return BY_CATEGORY.get(category) ?? OTHER_SEGMENT;
}

// opções do seletor "categoria deste estabelecimento", por segmento
export const CATEGORY_OPTIONS: { label: string; categories: string[] }[] = [
  ...SEGMENTS.map((s) => ({ label: s.label, categories: s.categories })),
  {
    label: "Não contam como gasto",
    categories: ["Same person transfer", "Investments"],
  },
];
