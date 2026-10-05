-- Acesso por código: cada código é uma credencial pessoal e revogável de um cliente.
-- Por trás, é um usuário do Supabase Auth (a senha é o código) vinculado ao cliente em
-- memberships, então o isolamento por RLS continua valendo. Esta tabela guarda só os
-- metadados; o código em si nunca é salvo (o Auth guarda apenas o hash da senha).
-- Criação, revogação e login por código passam pelo servidor com a chave service_role.

create table public.access_codes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  -- parte pública do código (identifica o usuário); o resto é o segredo
  public_id text not null unique check (public_id ~ '^[a-z0-9]{4}$'),
  label text check (char_length(label) <= 120),
  role text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  last_used_at timestamptz
);
create index access_codes_client_id_idx on public.access_codes (client_id);

alter table public.access_codes enable row level security;

-- só a equipe lista; escrita só pelo servidor (service_role ignora o RLS)
create policy access_codes_select on public.access_codes for select to authenticated
  using (private.is_staff());

revoke all on public.access_codes from anon;
revoke insert, update, delete on public.access_codes from authenticated;
