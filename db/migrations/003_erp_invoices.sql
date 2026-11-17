-- Notas fiscais emitidas pelo próprio usuário no portal do governo (Emissor Nacional) e
-- registradas aqui: pelo XML baixado do portal (preenche tudo sozinho) ou à mão.
-- O sistema não guarda senha do gov.br nem emite no lugar da pessoa.
create table erp_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant text not null,
  sale_id uuid references erp_sales (id) on delete set null,
  kind text not null default 'nfse' check (kind in ('nfse')),
  number text not null default '',
  access_key text not null default '',
  issue_date date not null,
  amount numeric(14, 2) not null check (amount >= 0),
  customer_name text not null default '',
  customer_document text not null default '',
  description text not null default '',
  -- XML original do portal; permite gerar o PDF (DANFSe) e conferir a nota depois
  xml text,
  source text not null default 'manual' check (source in ('xml', 'manual')),
  status text not null default 'issued' check (status in ('issued', 'canceled')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index erp_invoices_tenant_date_idx on erp_invoices (tenant, issue_date desc);
create index erp_invoices_sale_idx on erp_invoices (sale_id);
create unique index erp_invoices_key_uq on erp_invoices (tenant, access_key) where access_key <> '';

-- mesma proteção das outras tabelas do ERP: sem acesso pela API pública do Supabase
alter table public.erp_invoices enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.erp_invoices from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.erp_invoices from authenticated;
  end if;
end $$;
