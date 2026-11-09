// Tipos compartilhados entre as rotas do ERP e as telas (só tipos, sem código de servidor).

export type PartyStatus = "lead" | "active" | "inactive";

export type Party = {
  id: string;
  is_customer: boolean;
  is_supplier: boolean;
  person_type: "pf" | "pj";
  name: string;
  trade_name: string;
  document: string;
  email: string;
  phone: string;
  zip: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  notes: string;
  status: PartyStatus;
  demo: boolean;
  created_at: string;
  // preenchidos na listagem
  sales_total?: number;
  sales_count?: number;
  open_receivable?: number;
  overdue_receivable?: number;
  open_payable?: number;
  last_sale?: string | null;
};

export type ProductKind = "product" | "service";

export type Product = {
  id: string;
  sku: string;
  name: string;
  kind: ProductKind;
  unit: string;
  category: string;
  cost_price: number;
  sale_price: number;
  track_stock: boolean;
  min_stock: number;
  active: boolean;
  notes: string;
  demo: boolean;
  stock?: number;
};

export type StockReason =
  | "initial"
  | "purchase"
  | "sale"
  | "adjust"
  | "loss"
  | "return"
  | "sale_cancel"
  | "purchase_cancel";

export type StockMove = {
  id: string;
  product_id: string;
  product_name: string;
  unit: string;
  qty: number;
  unit_cost: number;
  reason: StockReason;
  ref_type: string | null;
  ref_id: string | null;
  note: string;
  created_at: string;
};

export type SaleStatus = "quote" | "confirmed" | "canceled";

export type SaleItem = {
  id?: string;
  product_id: string | null;
  description: string;
  qty: number;
  unit_price: number;
  unit_cost?: number;
  discount: number;
  total: number;
};

export type Sale = {
  id: string;
  number: number;
  customer_id: string | null;
  customer_name: string | null;
  status: SaleStatus;
  issue_date: string;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: string;
  notes: string;
  confirmed_at: string | null;
  items_count?: number;
  received?: number;
  open?: number;
  overdue?: number;
  items?: SaleItem[];
  titles?: Title[];
};

export type PurchaseStatus = "draft" | "received" | "canceled";

export type PurchaseItem = {
  id?: string;
  product_id: string | null;
  description: string;
  qty: number;
  unit_cost: number;
  total: number;
};

export type Purchase = {
  id: string;
  number: number;
  supplier_id: string | null;
  supplier_name: string | null;
  status: PurchaseStatus;
  issue_date: string;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: string;
  notes: string;
  received_at: string | null;
  items_count?: number;
  items?: PurchaseItem[];
  titles?: Title[];
};

export type TitleStatus = "open" | "paid" | "canceled";

export type Title = {
  id: string;
  direction: "in" | "out";
  description: string;
  party_id: string | null;
  party_name: string | null;
  category_id: string | null;
  category_name: string | null;
  account_id: string | null;
  account_name: string | null;
  amount: number;
  due_date: string;
  status: TitleStatus;
  paid_at: string | null;
  paid_amount: number | null;
  origin_type: "manual" | "sale" | "purchase" | "recurring";
  origin_id: string | null;
  installment_no: number | null;
  installment_total: number | null;
  notes: string;
  overdue: boolean;
  days_late: number;
};

export type Category = { id: string; name: string; kind: "in" | "out"; used?: number };

export type Account = {
  id: string;
  name: string;
  kind: "cash" | "bank" | "wallet";
  initial_balance: number;
  active: boolean;
  balance: number;
};

export type Recurring = {
  id: string;
  direction: "in" | "out";
  description: string;
  party_id: string | null;
  party_name: string | null;
  category_id: string | null;
  category_name: string | null;
  amount: number;
  day: number;
  active: boolean;
  generated_this_month: boolean;
};

export type Company = {
  tenant: string;
  name: string;
  trade_name: string;
  document: string;
  email: string;
  phone: string;
  zip: string;
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  allow_negative_stock: boolean;
  has_demo: boolean;
};

export type ReportColumn = {
  key: string;
  label: string;
  type?: "text" | "money" | "qty" | "percent" | "date" | "int";
  align?: "left" | "right";
};

export type Report = {
  name: string;
  title: string;
  description: string;
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
  totals?: Record<string, string | number | null>;
  note?: string;
};

export const PAYMENT_METHODS = [
  "Dinheiro",
  "Pix",
  "Cartão de débito",
  "Cartão de crédito",
  "Boleto",
  "Transferência",
  "Outro",
] as const;
