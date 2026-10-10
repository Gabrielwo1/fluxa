-- ---------------------------------------------------------------------------
-- Emissão de NFS-e (padrão nacional) dentro do banco mestre.
--
-- Mesma regra do resto do Fluxa: tudo carrega client_id e o isolamento é do Postgres,
-- não só do código. Um cliente é uma empresa, então tem um emitente fiscal — daí o
-- unique em client_id.
--
-- As credenciais de emissão (certificado A1 e senha do portal) ficam cifradas pelo app
-- antes de chegar aqui (AES-256-GCM, chave em CREDENCIAIS_CHAVE, fora do banco). Mesmo
-- quem lê a tabela não lê a senha. O número de série do A3 é identificador, não segredo,
-- e por isso fica em texto.
-- ---------------------------------------------------------------------------

create table if not exists public.emitentes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  cnpj char(14) not null,
  razao_social text not null,
  regime text not null check (regime in ('MEI', 'SIMPLES', 'PRESUMIDO', 'REAL')),
  codigo_municipio char(7) not null,
  municipio_nome text,
  uf char(2),
  -- atividades do CNPJ, usadas para sugerir o código de serviço de cada nota
  cnaes jsonb not null default '[]'::jsonb,
  email text,
  serie int not null default 1,
  modo_emissao text not null default 'simulacao'
    check (modo_emissao in ('simulacao', 'sefin', 'portal', 'a3')),
  ambiente text not null default 'homologacao' check (ambiente in ('homologacao', 'producao')),
  -- passou pela etapa de conectar a conta do governo, mesmo que tenha ficado em simulação
  onboarding_concluido boolean not null default false,
  ultimo_nsu bigint not null default 0,
  importado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id)
);

create table if not exists public.emitente_credenciais (
  emitente_id uuid primary key references public.emitentes(id) on delete cascade,
  -- repetido de propósito: a política de acesso lê o client_id sem precisar de join
  client_id uuid not null references public.clients(id) on delete cascade,
  pfx_cifrado text,
  senha_pfx_cifrada text,
  login_portal text,
  senha_portal_cifrada text,
  serie_a3 text,
  updated_at timestamptz not null default now()
);

-- Registro financeiro: toda nota que o app está emitindo, já emitiu, importou do governo
-- ou que a pessoa registrou à mão. As colunas soltas (valor, competência, tomador) existem
-- para somar sem abrir o JSON.
create table if not exists public.notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  emitente_id uuid not null references public.emitentes(id) on delete cascade,
  numero_dps int not null,
  serie int not null,                       -- 0 = registro manual
  status text not null check (status in ('processando', 'emitida', 'simulada', 'registrada', 'erro', 'cancelada')),
  origem text not null default 'app' check (origem in ('app', 'manual', 'importada')),
  modo text not null,                       -- simulacao | sefin | portal | manual
  chave_acesso text,
  valor numeric(12, 2) not null,
  competencia date not null,
  tomador_nome text not null,
  tomador_documento text not null,
  descricao text not null,
  rascunho jsonb not null,
  xml_nfse text,
  erros jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (emitente_id, serie, numero_dps)
);
create index if not exists notas_fiscais_cliente_idx
  on public.notas_fiscais (client_id, competencia desc);
-- A chave de acesso é o identificador oficial da nota, e é por ela que a importação
-- deduplica. O índice não pode ser parcial: o Postgres não infere índice parcial em
-- ON CONFLICT. Como NULL é distinto de NULL, notas sem chave (simuladas, manuais) convivem.
create unique index if not exists notas_fiscais_chave_unica
  on public.notas_fiscais (emitente_id, chave_acesso);

-- Numeração do DPS por emitente e série. O governo recusa número repetido, então o
-- contador vive no banco e não na aplicação.
create table if not exists public.contadores_dps (
  emitente_id uuid not null references public.emitentes(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  serie int not null,
  ultimo int not null default 0,
  primary key (emitente_id, serie)
);

create trigger emitentes_set_updated_at
  before update on public.emitentes
  for each row execute function public.set_updated_at();
create trigger notas_fiscais_set_updated_at
  before update on public.notas_fiscais
  for each row execute function public.set_updated_at();

-- Próximo número da série, reservado de forma atômica. security invoker: a política de
-- contadores_dps continua valendo, então ninguém reserva número de outro cliente.
create or replace function public.proximo_numero_dps(p_emitente uuid, p_serie int)
returns int language plpgsql security invoker
set search_path = public, pg_temp as $$
declare
  n int;
  cid uuid;
begin
  select client_id into cid from public.emitentes where id = p_emitente;
  if cid is null then
    raise exception 'emitente não encontrado';
  end if;
  insert into public.contadores_dps (emitente_id, client_id, serie, ultimo)
    values (p_emitente, cid, p_serie, 1)
  on conflict (emitente_id, serie) do update set ultimo = public.contadores_dps.ultimo + 1
  returning ultimo into n;
  return n;
end $$;

-- Número e série de nota importada vêm do XML, não do contador. Alinha o contador com o
-- maior número já usado, senão a próxima emissão pelo app colide com o histórico.
create or replace function public.sincronizar_contador_dps(p_emitente uuid, p_serie int)
returns int language plpgsql security invoker
set search_path = public, pg_temp as $$
declare
  maior int;
  cid uuid;
begin
  select client_id into cid from public.emitentes where id = p_emitente;
  if cid is null then
    raise exception 'emitente não encontrado';
  end if;
  select coalesce(max(numero_dps), 0) into maior
    from public.notas_fiscais where emitente_id = p_emitente and serie = p_serie;

  insert into public.contadores_dps (emitente_id, client_id, serie, ultimo)
  values (p_emitente, cid, p_serie, maior)
  on conflict (emitente_id, serie)
    do update set ultimo = greatest(public.contadores_dps.ultimo, maior);

  return maior;
end $$;

-- ---------------------------------------------------------------------------
-- RLS: mesma regra das outras tabelas do cliente
-- ---------------------------------------------------------------------------

alter table public.emitentes enable row level security;
alter table public.emitente_credenciais enable row level security;
alter table public.notas_fiscais enable row level security;
alter table public.contadores_dps enable row level security;

create policy emitentes_select on public.emitentes for select to authenticated
  using (private.is_staff() or private.is_member(client_id));
create policy emitentes_insert on public.emitentes for insert to authenticated
  with check (private.can_edit(client_id));
create policy emitentes_update on public.emitentes for update to authenticated
  using (private.can_edit(client_id)) with check (private.can_edit(client_id));
create policy emitentes_delete on public.emitentes for delete to authenticated
  using (private.can_edit(client_id));

create policy emitente_credenciais_select on public.emitente_credenciais for select to authenticated
  using (private.is_staff() or private.is_member(client_id));
create policy emitente_credenciais_insert on public.emitente_credenciais for insert to authenticated
  with check (private.can_edit(client_id));
create policy emitente_credenciais_update on public.emitente_credenciais for update to authenticated
  using (private.can_edit(client_id)) with check (private.can_edit(client_id));
create policy emitente_credenciais_delete on public.emitente_credenciais for delete to authenticated
  using (private.can_edit(client_id));

create policy notas_fiscais_select on public.notas_fiscais for select to authenticated
  using (private.is_staff() or private.is_member(client_id));
create policy notas_fiscais_insert on public.notas_fiscais for insert to authenticated
  with check (private.can_edit(client_id));
create policy notas_fiscais_update on public.notas_fiscais for update to authenticated
  using (private.can_edit(client_id)) with check (private.can_edit(client_id));
create policy notas_fiscais_delete on public.notas_fiscais for delete to authenticated
  using (private.can_edit(client_id));

create policy contadores_dps_select on public.contadores_dps for select to authenticated
  using (private.is_staff() or private.is_member(client_id));
create policy contadores_dps_insert on public.contadores_dps for insert to authenticated
  with check (private.can_edit(client_id));
create policy contadores_dps_update on public.contadores_dps for update to authenticated
  using (private.can_edit(client_id)) with check (private.can_edit(client_id));
create policy contadores_dps_delete on public.contadores_dps for delete to authenticated
  using (private.can_edit(client_id));
