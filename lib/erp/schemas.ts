import { z } from "zod";
import { digits, isValidDocument } from "@/lib/erp/validators";

const text = (max = 200) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`).default("");
const money = (label: string) =>
  z.coerce.number({ error: `Informe ${label}.` }).min(0, `${label} não pode ser negativo.`).max(1e10, "Valor muito alto.");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

export const partySchema = z
  .object({
    is_customer: z.boolean().default(true),
    is_supplier: z.boolean().default(false),
    person_type: z.enum(["pf", "pj"]).default("pf"),
    name: z.string().trim().min(1, "Informe o nome.").max(200),
    trade_name: text(),
    document: text(20),
    email: z
      .string()
      .trim()
      .max(200)
      .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido.")
      .default(""),
    phone: text(30),
    zip: text(12),
    street: text(),
    number: text(20),
    complement: text(100),
    district: text(100),
    city: text(100),
    state: text(2),
    notes: text(2000),
    status: z.enum(["lead", "active", "inactive"]).default("active"),
  })
  .refine((v) => v.is_customer || v.is_supplier, { message: "Marque cliente, fornecedor ou os dois." })
  .refine((v) => v.document === "" || isValidDocument(v.document), {
    message: "CPF ou CNPJ inválido. Confira os números.",
    path: ["document"],
  })
  .transform((v) => ({ ...v, document: digits(v.document), zip: digits(v.zip), state: v.state.toUpperCase() }));

export const productSchema = z.object({
  sku: text(40),
  name: z.string().trim().min(1, "Informe o nome do produto.").max(200),
  kind: z.enum(["product", "service"]).default("product"),
  unit: z.string().trim().min(1, "Informe a unidade (un, kg, h…).").max(10).default("un"),
  category: text(80),
  cost_price: money("o custo").default(0),
  sale_price: money("o preço de venda").default(0),
  track_stock: z.boolean().default(true),
  min_stock: money("o estoque mínimo").default(0),
  active: z.boolean().default(true),
  notes: text(2000),
  // só na criação: quantidade que já existe hoje na prateleira
  initial_stock: money("o estoque inicial").default(0),
});

export const stockMoveSchema = z.object({
  product_id: z.uuid("Escolha o produto."),
  mode: z.enum(["in", "out", "count"]),
  qty: z.coerce.number({ error: "Informe a quantidade." }).min(0, "A quantidade não pode ser negativa."),
  reason: z.enum(["adjust", "loss", "return", "initial", "purchase"]).default("adjust"),
  unit_cost: money("o custo").optional(),
  note: text(300),
});

const saleItem = z.object({
  product_id: z.uuid().nullable().default(null),
  description: z.string().trim().min(1, "Descreva o item.").max(300),
  qty: z.coerce.number({ error: "Informe a quantidade." }).gt(0, "A quantidade precisa ser maior que zero."),
  unit_price: money("o preço"),
  discount: money("o desconto").default(0),
});

export const paymentSchema = z.object({
  method: text(40),
  installments: z.coerce.number().int().min(1, "Mínimo 1 parcela.").max(48, "Máximo 48 parcelas.").default(1),
  first_due: date,
  interval_days: z.coerce.number().int().min(1).max(365).default(30),
  paid_now: z.boolean().default(false),
  account_id: z.uuid().nullable().default(null),
});

export const saleSchema = z.object({
  customer_id: z.uuid().nullable().default(null),
  issue_date: date,
  items: z.array(saleItem).min(1, "Adicione pelo menos um item."),
  discount: money("o desconto").default(0),
  notes: text(2000),
  payment_method: text(40),
  // se vier, a venda já nasce confirmada
  confirm: paymentSchema.optional(),
});

export const confirmSchema = paymentSchema;

const purchaseItem = z.object({
  product_id: z.uuid().nullable().default(null),
  description: z.string().trim().min(1, "Descreva o item.").max(300),
  qty: z.coerce.number({ error: "Informe a quantidade." }).gt(0, "A quantidade precisa ser maior que zero."),
  unit_cost: money("o custo"),
});

export const purchaseSchema = z.object({
  supplier_id: z.uuid().nullable().default(null),
  issue_date: date,
  items: z.array(purchaseItem).min(1, "Adicione pelo menos um item."),
  discount: money("o desconto").default(0),
  notes: text(2000),
  payment_method: text(40),
  receive: paymentSchema.optional(),
});

export const titleSchema = z.object({
  direction: z.enum(["in", "out"]),
  description: z.string().trim().min(1, "Descreva o lançamento.").max(300),
  party_id: z.uuid().nullable().default(null),
  category_id: z.uuid().nullable().default(null),
  amount: z.coerce.number({ error: "Informe o valor." }).gt(0, "O valor precisa ser maior que zero.").max(1e10),
  due_date: date,
  installments: z.coerce.number().int().min(1).max(48).default(1),
  notes: text(2000),
  paid_now: z.boolean().default(false),
  account_id: z.uuid().nullable().default(null),
});

export const titleUpdateSchema = z.object({
  description: z.string().trim().min(1).max(300).optional(),
  party_id: z.uuid().nullable().optional(),
  category_id: z.uuid().nullable().optional(),
  amount: z.coerce.number().gt(0).max(1e10).optional(),
  due_date: date.optional(),
  notes: text(2000).optional(),
});

export const paySchema = z.object({
  paid_at: date,
  paid_amount: z.coerce.number({ error: "Informe o valor pago." }).gt(0, "O valor pago precisa ser maior que zero."),
  account_id: z.uuid("Escolha onde o dinheiro entrou ou saiu."),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(80),
  kind: z.enum(["in", "out"]),
});

export const accountSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(80),
  kind: z.enum(["cash", "bank", "wallet"]).default("bank"),
  initial_balance: z.coerce.number().min(-1e10).max(1e10).default(0),
  active: z.boolean().default(true),
});

export const recurringSchema = z.object({
  direction: z.enum(["in", "out"]),
  description: z.string().trim().min(1, "Descreva o lançamento.").max(300),
  party_id: z.uuid().nullable().default(null),
  category_id: z.uuid().nullable().default(null),
  amount: z.coerce.number({ error: "Informe o valor." }).gt(0, "O valor precisa ser maior que zero.").max(1e10),
  day: z.coerce.number().int().min(1, "Dia de 1 a 31.").max(31, "Dia de 1 a 31."),
  active: z.boolean().default(true),
});

export const companySchema = z.object({
  name: text(200),
  trade_name: text(200),
  document: text(20),
  email: text(200),
  phone: text(30),
  zip: text(12),
  street: text(200),
  number: text(20),
  district: text(100),
  city: text(100),
  state: text(2),
  allow_negative_stock: z.boolean().default(false),
});
