import {
  ArrowLeftRight,
  Banknote,
  BedDouble,
  Building2,
  ParkingSquare,
  Route,
  Coins,
  Dices,
  Laptop,
  Percent,
  Stethoscope,
  Tv,
  Zap,
  Bike,
  Bus,
  Car,
  CircleDollarSign,
  Clapperboard,
  CreditCard,
  Dumbbell,
  Fuel,
  GraduationCap,
  HandCoins,
  HeartPulse,
  Home,
  Lightbulb,
  MonitorSmartphone,
  PawPrint,
  Plane,
  Receipt,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Utensils,
  Wifi,
  Wrench,
  type LucideIcon,
} from "lucide-react";

// ícone + cor decorativa do círculo por categoria (categoria crua da Pluggy)
type IconSpec = { Icon: LucideIcon; tint: string };

const TINTS = {
  emerald: "bg-emerald-500/15 text-emerald-500",
  violet: "bg-violet-500/15 text-violet-400",
  amber: "bg-amber-500/15 text-amber-500",
  sky: "bg-sky-500/15 text-sky-400",
  rose: "bg-rose-500/15 text-rose-400",
  neutral: "bg-neutral-500/15 text-neutral-400",
};

const MAP: Record<string, IconSpec> = {
  Shopping: { Icon: ShoppingBag, tint: TINTS.violet },
  "Online shopping": { Icon: ShoppingBag, tint: TINTS.violet },
  Transfers: { Icon: ArrowLeftRight, tint: TINTS.sky },
  "Same person transfer": { Icon: ArrowLeftRight, tint: TINTS.sky },
  "Eating out": { Icon: Utensils, tint: TINTS.amber },
  "Food and drinks": { Icon: Utensils, tint: TINTS.amber },
  "Food delivery": { Icon: Bike, tint: TINTS.amber },
  Groceries: { Icon: ShoppingCart, tint: TINTS.amber },
  Investments: { Icon: TrendingUp, tint: TINTS.emerald },
  "Fixed income investment": { Icon: TrendingUp, tint: TINTS.emerald },
  "Variable income investment": { Icon: TrendingUp, tint: TINTS.emerald },
  "Digital services": { Icon: MonitorSmartphone, tint: TINTS.sky },
  Services: { Icon: Wrench, tint: TINTS.neutral },
  "Gas stations": { Icon: Fuel, tint: TINTS.rose },
  "Tax on financial operations": { Icon: Receipt, tint: TINTS.neutral },
  Taxes: { Icon: Receipt, tint: TINTS.neutral },
  "Bank fees": { Icon: Receipt, tint: TINTS.neutral },
  "Vehicle maintenance": { Icon: Car, tint: TINTS.rose },
  Leisure: { Icon: Clapperboard, tint: TINTS.violet },
  Entertainment: { Icon: Clapperboard, tint: TINTS.violet },
  "Cinema, theater and concerts": { Icon: Clapperboard, tint: TINTS.violet },
  Travel: { Icon: Plane, tint: TINTS.sky },
  Health: { Icon: HeartPulse, tint: TINTS.rose },
  Pharmacy: { Icon: HeartPulse, tint: TINTS.rose },
  Education: { Icon: GraduationCap, tint: TINTS.sky },
  Telecommunications: { Icon: Wifi, tint: TINTS.sky },
  Rent: { Icon: Home, tint: TINTS.emerald },
  Housing: { Icon: Home, tint: TINTS.emerald },
  Utilities: { Icon: Lightbulb, tint: TINTS.amber },
  Income: { Icon: Banknote, tint: TINTS.emerald },
  Salary: { Icon: Banknote, tint: TINTS.emerald },
  Loans: { Icon: HandCoins, tint: TINTS.rose },
  "Loans and financing": { Icon: HandCoins, tint: TINTS.rose },
  Insurance: { Icon: Shield, tint: TINTS.neutral },
  "Credit card payment": { Icon: CreditCard, tint: TINTS.neutral },
  Gym: { Icon: Dumbbell, tint: TINTS.emerald },
  "Gyms and fitness centers": { Icon: Dumbbell, tint: TINTS.emerald },
  Clothing: { Icon: Shirt, tint: TINTS.violet },
  Pets: { Icon: PawPrint, tint: TINTS.amber },
  Transport: { Icon: Bus, tint: TINTS.sky },
  "Public transport": { Icon: Bus, tint: TINTS.sky },
  "Taxi and ride-hailing": { Icon: Bus, tint: TINTS.sky },
  Electronics: { Icon: Laptop, tint: TINTS.sky },
  Automotive: { Icon: Car, tint: TINTS.rose },
  Gambling: { Icon: Dices, tint: TINTS.violet },
  Accomodation: { Icon: BedDouble, tint: TINTS.violet },
  Healthcare: { Icon: Stethoscope, tint: TINTS.rose },
  Wellness: { Icon: HeartPulse, tint: TINTS.rose },
  "Wellness and fitness": { Icon: Dumbbell, tint: TINTS.emerald },
  Electricity: { Icon: Zap, tint: TINTS.amber },
  Internet: { Icon: Wifi, tint: TINTS.sky },
  "Interests charged": { Icon: Percent, tint: TINTS.neutral },
  "Late payment and overdraft costs": { Icon: Percent, tint: TINTS.neutral },
  "Transfer - PIX": { Icon: ArrowLeftRight, tint: TINTS.sky },
  "Transfer - Foreign Exchange": { Icon: Coins, tint: TINTS.sky },
  "Pet supplies and vet": { Icon: PawPrint, tint: TINTS.amber },
  Cashback: { Icon: Coins, tint: TINTS.emerald },
  "Video streaming": { Icon: Tv, tint: TINTS.sky },
  Bakery: { Icon: Utensils, tint: TINTS.amber },
  Transportation: { Icon: Bus, tint: TINTS.sky },
  "Supplier payments": { Icon: Building2, tint: TINTS.sky },
  Parking: { Icon: ParkingSquare, tint: TINTS.rose },
  "Tolls and in vehicle payment": { Icon: Route, tint: TINTS.rose },
};

const DEFAULT: IconSpec = { Icon: CircleDollarSign, tint: TINTS.neutral };

export function categoryIcon(cat: string | null | undefined): IconSpec {
  if (!cat) return DEFAULT;
  return MAP[cat] ?? DEFAULT;
}

export function CategoryBadge({
  category,
  size = 9,
}: {
  category: string | null | undefined;
  size?: number;
}) {
  const { Icon, tint } = categoryIcon(category);
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full ${tint}`}
      style={{ width: size * 4, height: size * 4 }}
    >
      <Icon size={size * 1.8} strokeWidth={1.8} />
    </span>
  );
}
