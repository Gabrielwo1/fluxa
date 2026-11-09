-- Fluxa ERP: cadastros, estoque, vendas, compras e financeiro.
--
-- Todas as tabelas têm a coluna "tenant": é o slug da empresa (o mesmo de clients.slug).
-- O isolamento entre empresas é feito pela camada de acesso (lib/erp/db.ts), que só executa
-- consultas com o tenant da sessão; nenhuma consulta do app roda sem esse filtro.
-- Valores em reais ficam em numeric (nunca float), quantidades com 3 casas.

create extension if not exists pgcrypto;

-- "hoje" no fuso do Brasil, independente do fuso do servidor do banco
create function erp_today() returns date
  language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- dados da empresa e contadores de numeração (vendas, compras)
create table erp_company (
  tenant text primary key,
  name text not null default '',
  trade_name text not null default '',
  document text not null default '',
  email text not null default '',
  phone text not null default '',
  zip text not null default '',
  street text not null default '',
  number text not null default '',
  district text not null default '',
  city text not null default '',
  state text not null default '',
  next_sale_number integer not null default 1,
  next_purchase_number integer not null default 1,
  has_demo boolean not null default false,
  -- permite vender mais do que o estoque registrado (o saldo fica negativo até a compra ser lançada)
  allow_negative_stock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- clientes e fornecedores (a mesma pessoa pode ser os dois)
create table erp_parties (
  id uuid primary key default gen_random_uuid(),
  tenant text not null,
  is_customer boolean not null default true,
  is_supplier boolean not null default false,
  person_type text not null default 'pf' check (person_type in ('pf', 'pj')),
  name text not null check (char_length(name) between 1 and 200),
  trade_name text not null default '',
  document text not null default '',
  email text not null default '',
  phone text not null default '',
  zip text not null default '',
  street text not null default '',
  number text not null default '',
  complement text not null default '',
  district text not null default '',
  city text not null default '',
  state text not null default '',
  notes text not null default '',
  -- lead: ainda negociando; active: já compra ou vende; inactive: arquivado
  status text not null default 'active' check (status in ('lead', 'active', 'inactive')),
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_customer or is_supplier)
);
create index erp_parties_tenant_name_idx on erp_parties (tenant, lower(name));
create index erp_parties_tenant_doc_idx on erp_parties (tenant, document) where document <> '';

-- plano de contas simplificado: categorias de receita e de despesa
create table erp_categories (
  id uuid primary key default gen_random_uuid(),
  tenant text not null,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null check (kind in ('in', 'out')),
  created_at timestamptz not null default now(),
  unique (tenant, kind, name)
);

-- onde o dinheiro está: caixa, conta bancária, carteira digital
create table erp_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant text not null,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null default 'bank' check (kind in ('cash', 'bank', 'wallet')),
  initial_balance numeric(14, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant, name)
);

-- catálogo: produtos e serviços
create table erp_products (
  id uuid primary key default gen_random_uuid(),
  tenant text not null,
  sku text not null default '',
  name text not null check (char_length(name) between 1 and 200),
  kind text not null default 'product' check (kind in ('product', 'service')),
  unit text not null default 'un',
  category text not null default '',
  cost_price numeric(14, 4) not null default 0 check (cost_price >= 0),
  sale_price numeric(14, 2) not null default 0 check (sale_price >= 0),
  track_stock boolean not null default true,
  min_stock numeric(14, 3) not null default 0 check (min_stock >= 0),
  active boolean not null default true,
  notes text not null default '',
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index erp_products_tenant_name_idx on erp_products (tenant, lower(name));
create unique index erp_products_tenant_sku_uq on erp_products (tenant, lower(sku)) where sku <> '';

-- livro de estoque: o saldo é a soma das quantidades (entrada positiva, saída negativa)
create table erp_stock_moves (
  id uuid primary key default gen_random_uuid(),
  tenant text not null,
  product_id uuid not null references erp_products (id) on delete cascade,
  qty numeric(14, 3) not null check (qty <> 0),
  unit_cost numeric(14, 4) not null default 0,
  reason text not null check (
    reason in ('initial', 'purchase', 'sale', 'adjust', 'loss', 'return', 'sale_cancel', 'purchase_cancel')
  ),
  ref_type text,
  ref_id uuid,
  note text not null default '',
  demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index erp_stock_moves_product_idx on erp_stock_moves (tenant, product_id, created_at desc);
create index erp_stock_moves_ref_idx on erp_stock_moves (ref_type, ref_id);

-- vendas e orçamentos
create table erp_sales (
  id uuid primary key default gen_random_uuid(),
  tenant text not null,
  number integer not null,
  customer_id uuid references erp_parties (id) on delete set null,
  status text not null default 'quote' check (status in ('quote', 'confirmed', 'canceled')),
  issue_date date not null default erp_today(),
  subtotal numeric(14, 2) not null default 0,
  discount numeric(14, 2) not null default 0 check (discount >= 0),
  total numeric(14, 2) not null default 0,
  payment_method text not null default '',
  notes text not null default '',
  confirmed_at timestamptz,
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant, number)
);
create index erp_sales_tenant_date_idx on erp_sales (tenant, issue_date desc);
create index erp_sales_customer_idx on erp_sales (tenant, customer_id);

create table erp_sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references erp_sales (id) on delete cascade,
  product_id uuid references erp_products (id) on delete set null,
  description text not null check (char_length(description) between 1 and 300),
  qty numeric(14, 3) not null check (qty > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  -- custo no momento da venda, para calcular a margem mesmo se o custo mudar depois
  unit_cost numeric(14, 4) not null default 0,
  discount numeric(14, 2) not null default 0 check (discount >= 0),
  total numeric(14, 2) not null,
  position integer not null default 0
);
create index erp_sale_items_sale_idx on erp_sale_items (sale_id);

-- compras de fornecedores
create table erp_purchases (
  id uuid primary key default gen_random_uuid(),
  tenant text not null,
  number integer not null,
  supplier_id uuid references erp_parties (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'received', 'canceled')),
  issue_date date not null default erp_today(),
  subtotal numeric(14, 2) not null default 0,
  discount numeric(14, 2) not null default 0 check (discount >= 0),
  total numeric(14, 2) not null default 0,
  payment_method text not null default '',
  notes text not null default '',
  received_at timestamptz,
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant, number)
);
create index erp_purchases_tenant_date_idx on erp_purchases (tenant, issue_date desc);

create table erp_purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references erp_purchases (id) on delete cascade,
  product_id uuid references erp_products (id) on delete set null,
  description text not null check (char_length(description) between 1 and 300),
  qty numeric(14, 3) not null check (qty > 0),
  unit_cost numeric(14, 4) not null check (unit_cost >= 0),
  total numeric(14, 2) not null,
  position integer not null default 0
);
create index erp_purchase_items_purchase_idx on erp_purchase_items (purchase_id);

-- contas a receber (in) e a pagar (out): uma linha por parcela
create table erp_titles (
  id uuid primary key default gen_random_uuid(),
  tenant text not null,
  direction text not null check (direction in ('in', 'out')),
  description text not null check (char_length(description) between 1 and 300),
  party_id uuid references erp_parties (id) on delete set null,
  category_id uuid references erp_categories (id) on delete set null,
  account_id uuid references erp_accounts (id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  due_date date not null,
  status text not null default 'open' check (status in ('open', 'paid', 'canceled')),
  paid_at date,
  paid_amount numeric(14, 2),
  origin_type text not null default 'manual' check (origin_type in ('manual', 'sale', 'purchase', 'recurring')),
  origin_id uuid,
  installment_no smallint,
  installment_total smallint,
  -- mês de competência (AAAA-MM) dos lançamentos gerados por recorrência
  competence text,
  notes text not null default '',
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'paid') = (paid_at is not null))
);
create index erp_titles_open_idx on erp_titles (tenant, direction, status, due_date);
create index erp_titles_origin_idx on erp_titles (origin_type, origin_id);
create unique index erp_titles_recurring_uq on erp_titles (origin_id, competence)
  where origin_type = 'recurring' and status <> 'canceled';

-- modelos que se repetem todo mês (aluguel, mensalidade de cliente)
create table erp_recurring (
  id uuid primary key default gen_random_uuid(),
  tenant text not null,
  direction text not null check (direction in ('in', 'out')),
  description text not null check (char_length(description) between 1 and 300),
  party_id uuid references erp_parties (id) on delete set null,
  category_id uuid references erp_categories (id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  day smallint not null default 1 check (day between 1 and 31),
  active boolean not null default true,
  demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index erp_recurring_tenant_idx on erp_recurring (tenant, active);
