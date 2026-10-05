-- Núcleo multi-cliente: um banco mestre, cada cliente com os seus próprios dados.
-- Isolamento por linha (client_id + RLS). Cada cliente é uma conexão própria da
-- Pluggy (pluggy_connections); um item da Pluggy só pode pertencer a um cliente.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status text not null default 'onboarding'
    check (status in ('onboarding', 'active', 'paused', 'archived')),
  plan text not null default 'pilot',
  -- configuração própria do cliente (rotinas, rótulos, módulos ligados)
  settings jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- quem opera a plataforma (acessa todos os clientes)
create table public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- quem do lado do cliente enxerga o painel dele
create table public.memberships (
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (user_id, client_id)
);
create index memberships_client_id_idx on public.memberships (client_id);

-- uma linha por item da Pluggy (conexão com os bancos do cliente)
create table public.pluggy_connections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  pluggy_item_id text not null unique,
  label text,
  connector_name text,
  status text not null default 'active' check (status in ('active', 'paused', 'revoked')),
  connected_at timestamptz not null default now(),
  last_checked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  meta jsonb not null default '{}'::jsonb
);
create index pluggy_connections_client_id_idx on public.pluggy_connections (client_id);

create table public.fixed_bills (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  amount numeric(14, 2) not null check (amount > 0),
  day smallint not null default 1 check (day between 1 and 31),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index fixed_bills_client_id_idx on public.fixed_bills (client_id);

-- "este estabelecimento sempre vai nesta categoria", por cliente
create table public.category_rules (
  client_id uuid not null references public.clients (id) on delete cascade,
  merchant_key text not null check (char_length(merchant_key) between 1 and 200),
  category text not null check (char_length(category) between 1 and 120),
  created_at timestamptz not null default now(),
  primary key (client_id, merchant_key)
);

-- contatos vindos da página de anúncios
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null default 'lp',
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 160),
  company text not null check (char_length(company) between 1 and 160),
  role text check (char_length(role) <= 120),
  phone text check (char_length(phone) <= 30),
  size text check (char_length(size) <= 80),
  pain text check (char_length(pain) <= 600),
  consent_at timestamptz not null,
  utm jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'discarded'))
);

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Funções de apoio às políticas (schema private: não expostas pela API)
-- ---------------------------------------------------------------------------

create function private.is_staff() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.staff s where s.user_id = (select auth.uid())
  );
$$;

create function private.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.client_id = cid and m.user_id = (select auth.uid())
  );
$$;

create function private.can_edit(cid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_staff() or exists (
    select 1 from public.memberships m
    where m.client_id = cid
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'editor')
  );
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke execute on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.clients enable row level security;
alter table public.staff enable row level security;
alter table public.memberships enable row level security;
alter table public.pluggy_connections enable row level security;
alter table public.fixed_bills enable row level security;
alter table public.category_rules enable row level security;
alter table public.leads enable row level security;

-- clients
create policy clients_select on public.clients for select to authenticated
  using (private.is_staff() or private.is_member(id));
create policy clients_insert on public.clients for insert to authenticated
  with check (private.is_staff());
create policy clients_update on public.clients for update to authenticated
  using (private.is_staff()) with check (private.is_staff());
create policy clients_delete on public.clients for delete to authenticated
  using (private.is_staff());

-- staff: cada um só enxerga a própria linha; ninguém escreve pela API
create policy staff_select on public.staff for select to authenticated
  using (user_id = (select auth.uid()));

-- memberships
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or private.is_staff());
create policy memberships_insert on public.memberships for insert to authenticated
  with check (private.is_staff());
create policy memberships_update on public.memberships for update to authenticated
  using (private.is_staff()) with check (private.is_staff());
create policy memberships_delete on public.memberships for delete to authenticated
  using (private.is_staff());

-- pluggy_connections
create policy pluggy_connections_select on public.pluggy_connections for select to authenticated
  using (private.is_staff() or private.is_member(client_id));
create policy pluggy_connections_insert on public.pluggy_connections for insert to authenticated
  with check (private.can_edit(client_id));
create policy pluggy_connections_update on public.pluggy_connections for update to authenticated
  using (private.can_edit(client_id)) with check (private.can_edit(client_id));
create policy pluggy_connections_delete on public.pluggy_connections for delete to authenticated
  using (private.can_edit(client_id));

-- fixed_bills
create policy fixed_bills_select on public.fixed_bills for select to authenticated
  using (private.is_staff() or private.is_member(client_id));
create policy fixed_bills_insert on public.fixed_bills for insert to authenticated
  with check (private.can_edit(client_id));
create policy fixed_bills_update on public.fixed_bills for update to authenticated
  using (private.can_edit(client_id)) with check (private.can_edit(client_id));
create policy fixed_bills_delete on public.fixed_bills for delete to authenticated
  using (private.can_edit(client_id));

-- category_rules
create policy category_rules_select on public.category_rules for select to authenticated
  using (private.is_staff() or private.is_member(client_id));
create policy category_rules_insert on public.category_rules for insert to authenticated
  with check (private.can_edit(client_id));
create policy category_rules_update on public.category_rules for update to authenticated
  using (private.can_edit(client_id)) with check (private.can_edit(client_id));
create policy category_rules_delete on public.category_rules for delete to authenticated
  using (private.can_edit(client_id));

-- leads: qualquer visitante insere (com consentimento); só a equipe lê e gerencia
create policy leads_insert on public.leads for insert to anon, authenticated
  with check (consent_at is not null and status = 'new');
create policy leads_select on public.leads for select to authenticated
  using (private.is_staff());
create policy leads_update on public.leads for update to authenticated
  using (private.is_staff()) with check (private.is_staff());
create policy leads_delete on public.leads for delete to authenticated
  using (private.is_staff());

-- ---------------------------------------------------------------------------
-- Privilégios: anon não toca nada, exceto inserir lead
-- ---------------------------------------------------------------------------

revoke all on public.clients, public.staff, public.memberships,
  public.pluggy_connections, public.fixed_bills, public.category_rules,
  public.leads from anon;
grant insert on public.leads to anon;

revoke insert, update, delete on public.staff from authenticated;
