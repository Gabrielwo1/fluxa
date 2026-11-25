-- Integrações: dados que chegam de fora (atendente do WhatsApp, loja virtual, Mercado Livre).
--
-- Cada registro que chega leva o identificador que tem na origem (external_id). A tabela
-- erp_external_refs liga esse identificador ao registro do Fluxa, e é isso que impede duplicar:
-- reenviar o mesmo pedido ou o mesmo cliente atualiza em vez de criar outro.

create table erp_external_refs (
  tenant text not null,
  source text not null,
  kind text not null check (kind in ('party', 'sale', 'invoice')),
  external_id text not null,
  local_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant, source, kind, external_id)
);
create index erp_external_refs_local_idx on erp_external_refs (tenant, kind, local_id);

-- de onde veio o cliente (manual, atendente, loja, mercadolivre) e como ele chegou (anúncio, orgânico…)
alter table erp_parties
  add column source text not null default 'manual',
  add column origin text not null default '',
  add column first_contact_at timestamptz;
create index erp_parties_tenant_phone_idx on erp_parties (tenant, right(regexp_replace(phone, '\D', '', 'g'), 11))
  where phone <> '';

-- canal da venda: balcao (lançada à mão), whatsapp, loja, mercadolivre
alter table erp_sales add column channel text not null default 'balcao';
create index erp_sales_channel_idx on erp_sales (tenant, channel, issue_date desc);

-- notas de produto (NF-e) vindas do Mercado Livre, além da NFS-e que já existia
alter table erp_invoices drop constraint if exists erp_invoices_kind_check;
alter table erp_invoices add constraint erp_invoices_kind_check check (kind in ('nfse', 'nfe'));
alter table erp_invoices drop constraint if exists erp_invoices_source_check;
alter table erp_invoices add constraint erp_invoices_source_check check (source in ('xml', 'manual', 'integration'));

-- números diários de cada canal (visitas, funil da loja, pedidos); um envio por dia sobrescreve o anterior
create table erp_channel_stats (
  tenant text not null,
  source text not null,
  day date not null,
  visitors integer not null default 0,
  sessions integer not null default 0,
  product_views integer not null default 0,
  add_to_cart integer not null default 0,
  checkouts integer not null default 0,
  orders integer not null default 0,
  revenue numeric(14, 2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tenant, source, day)
);

-- um registro por envio recebido: o que chegou, o que foi criado e o que deu errado
create table erp_sync_log (
  id uuid primary key default gen_random_uuid(),
  tenant text not null,
  source text not null,
  created integer not null default 0,
  updated integer not null default 0,
  skipped integer not null default 0,
  failed integer not null default 0,
  errors jsonb not null default '[]',
  at timestamptz not null default now()
);
create index erp_sync_log_idx on erp_sync_log (tenant, source, at desc);

-- mesma proteção das outras tabelas do ERP: sem acesso pela API pública do Supabase
do $$
declare t text;
begin
  foreach t in array array['erp_external_refs', 'erp_channel_stats', 'erp_sync_log']
  loop
    execute format('alter table public.%I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on public.%I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on public.%I from authenticated', t);
    end if;
  end loop;
end $$;
