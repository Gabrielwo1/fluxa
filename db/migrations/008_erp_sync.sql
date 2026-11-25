-- Sincronização automática: até que dia cada origem já foi puxada, e como foi a última tentativa.
-- O Fluxa busca sozinho no atendente (WhatsApp + Mercado Livre) e na loja; o que já foi puxado
-- não é buscado de novo, só a janela recente (para pegar pagamentos, cancelamentos e notas tardias).
create table erp_sync_state (
  tenant text not null,
  source text not null,
  synced_until date,
  last_run_at timestamptz,
  last_ok_at timestamptz,
  last_error text,
  primary key (tenant, source)
);

alter table public.erp_sync_state enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.erp_sync_state from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.erp_sync_state from authenticated;
  end if;
end $$;
