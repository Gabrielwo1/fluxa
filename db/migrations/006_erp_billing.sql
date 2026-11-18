-- Cobrança do Fluxa (Mercado Pago): pagamentos recebidos e a assinatura de cada empresa.
-- O preço é definido no servidor (lib/billing/plans.ts); estas tabelas só registram o que o Mercado Pago confirmou.

create table erp_payments (
  id text primary key,                 -- id do pagamento no Mercado Pago
  tenant text not null,
  kind text not null check (kind in ('implantacao', 'mensal')),
  amount numeric(10, 2) not null,
  status text not null,
  method text,
  -- vira true uma única vez, quando o pagamento aprovado é aplicado (libera o plano)
  applied boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index erp_payments_tenant_idx on erp_payments (tenant, created_at desc);

create table erp_subscriptions (
  tenant text primary key,
  valid_until timestamptz not null,
  -- cartão: cobrança automática todo mês (preapproval); Pix vale 30 dias e precisa ser pago de novo
  recurring boolean not null default false,
  mp_preapproval_id text,
  updated_at timestamptz not null default now()
);

alter table public.erp_payments enable row level security;
alter table public.erp_subscriptions enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.erp_payments from anon;
    revoke all on public.erp_subscriptions from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.erp_payments from authenticated;
    revoke all on public.erp_subscriptions from authenticated;
  end if;
end $$;
