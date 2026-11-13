-- No Supabase, tabelas do schema public ficam acessíveis pela API pública (PostgREST) com a chave
-- pública. O ERP só é acessado pelo servidor, direto no Postgres, então bloqueamos a API pública:
-- RLS ligado e sem nenhuma política (nega tudo para anon e authenticated) e sem permissões nelas.
-- O servidor conecta como dono das tabelas e não é afetado. Em Postgres comum não muda nada.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename like 'erp\_%' escape '\' and tablename <> 'erp_migrations'
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

alter table public.erp_migrations enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.erp_migrations from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.erp_migrations from authenticated;
  end if;
end $$;
