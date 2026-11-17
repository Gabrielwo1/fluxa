-- Interesse nas funções "em breve" (prospecção, atendimento por IA...). Cada empresa conta uma vez por função.
create table erp_interest (
  id uuid primary key default gen_random_uuid(),
  tenant text not null,
  feature text not null check (char_length(feature) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (tenant, feature)
);

alter table public.erp_interest enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.erp_interest from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.erp_interest from authenticated;
  end if;
end $$;
