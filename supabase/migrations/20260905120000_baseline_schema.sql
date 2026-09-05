-- FADE OS — baseline schema
--
-- Este projeto ainda não tinha migrations versionadas: o schema vivia apenas
-- no dashboard do Supabase. Esta migration reconstrói, de forma idempotente,
-- a estrutura já usada pelo código em produção (actions/*, lib/types.ts),
-- para que o banco passe a ser reproduzível a partir do repositório.
--
-- É seguro rodar contra o banco já existente: toda tabela/índice usa
-- IF NOT EXISTS e nenhuma coluna ou dado existente é alterado ou removido.
-- A camada de segurança (RLS, policies, funções, RPC de bootstrap) fica na
-- migration seguinte (20260905120100_tenancy_bootstrap_and_rls.sql).

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists btree_gist; -- exclusion constraint (agenda sem conflito de horário)

-- ---------------------------------------------------------------------------
-- role: tabela de referência dos papéis que um usuário pode ter numa empresa
-- ---------------------------------------------------------------------------
create table if not exists public.role (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null
);

insert into public.role (key, name)
values
  ('owner', 'Proprietário'),
  ('admin', 'Administrador'),
  ('staff', 'Equipe')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- company
-- ---------------------------------------------------------------------------
create table if not exists public.company (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trade_name text,
  document text,
  phone text,
  email text,
  address text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- user_company_role: vínculo usuário ⇄ empresa ⇄ papel (tenancy)
-- ---------------------------------------------------------------------------
create table if not exists public.user_company_role (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.company (id) on delete cascade,
  role_id uuid not null references public.role (id),
  created_at timestamptz not null default now(),
  unique (user_id, company_id)
);

create index if not exists user_company_role_user_id_idx on public.user_company_role (user_id);
create index if not exists user_company_role_company_id_idx on public.user_company_role (company_id);

-- ---------------------------------------------------------------------------
-- unit
-- ---------------------------------------------------------------------------
create table if not exists public.unit (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company (id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create index if not exists unit_company_id_idx on public.unit (company_id);

-- ---------------------------------------------------------------------------
-- professional
-- ---------------------------------------------------------------------------
create table if not exists public.professional (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company (id) on delete cascade,
  user_id uuid references auth.users (id),
  name text not null,
  email text,
  phone text,
  active boolean not null default true,
  default_commission_percent numeric(5, 2),
  created_at timestamptz not null default now()
);

create index if not exists professional_company_id_idx on public.professional (company_id);

-- ---------------------------------------------------------------------------
-- service
-- ---------------------------------------------------------------------------
create table if not exists public.service (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company (id) on delete cascade,
  name text not null,
  category text,
  default_price numeric(10, 2) not null default 0,
  planned_duration_minutes integer not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  default_commission_percent numeric(5, 2),
  created_at timestamptz not null default now()
);

create index if not exists service_company_id_idx on public.service (company_id);

-- ---------------------------------------------------------------------------
-- professional_service: quais profissionais realizam quais serviços
-- ---------------------------------------------------------------------------
create table if not exists public.professional_service (
  professional_id uuid not null references public.professional (id) on delete cascade,
  service_id uuid not null references public.service (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (professional_id, service_id)
);

create index if not exists professional_service_service_id_idx on public.professional_service (service_id);

-- Regra de negócio: um vínculo só faz sentido se profissional e serviço
-- forem da mesma empresa (evita ligar profissional da empresa A a serviço
-- da empresa B, mesmo que o usuário tenha acesso às duas).
create or replace function public.check_professional_service_same_company()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prof_company uuid;
  v_service_company uuid;
begin
  select company_id into v_prof_company from public.professional where id = new.professional_id;
  select company_id into v_service_company from public.service where id = new.service_id;

  if v_prof_company is null or v_service_company is null or v_prof_company <> v_service_company then
    raise exception 'Profissional e serviço precisam pertencer à mesma empresa.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_professional_service_same_company on public.professional_service;
create trigger trg_professional_service_same_company
  before insert or update on public.professional_service
  for each row execute function public.check_professional_service_same_company();

-- ---------------------------------------------------------------------------
-- client
-- ---------------------------------------------------------------------------
create table if not exists public.client (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  birth_date date,
  notes text,
  communication_consent boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists client_company_id_idx on public.client (company_id);

-- ---------------------------------------------------------------------------
-- appointment
-- ---------------------------------------------------------------------------
create table if not exists public.appointment (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company (id) on delete cascade,
  unit_id uuid not null references public.unit (id) on delete cascade,
  client_id uuid not null references public.client (id),
  status text not null default 'scheduled' check (
    status in (
      'scheduled', 'confirmed', 'in_progress', 'completed',
      'cancelled_by_client', 'cancelled_by_company', 'no_show'
    )
  ),
  created_at timestamptz not null default now()
);

create index if not exists appointment_company_id_idx on public.appointment (company_id);
create index if not exists appointment_unit_id_idx on public.appointment (unit_id);
create index if not exists appointment_client_id_idx on public.appointment (client_id);

-- ---------------------------------------------------------------------------
-- appointment_service: linhas de serviço de um agendamento
-- ---------------------------------------------------------------------------
create table if not exists public.appointment_service (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointment (id) on delete cascade,
  service_id uuid not null references public.service (id),
  professional_id uuid not null references public.professional (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint appointment_service_time_order check (ends_at > starts_at)
);

create index if not exists appointment_service_appointment_id_idx on public.appointment_service (appointment_id);
create index if not exists appointment_service_starts_at_idx on public.appointment_service (starts_at);

-- Um profissional não pode ter dois compromissos ativos com horários
-- sobrepostos — é a constraint que actions/agenda.ts espera (código de erro
-- 23P01 / exclusion_violation) ao tratar conflito de agenda.
alter table public.appointment_service
  drop constraint if exists appointment_service_no_overlap;

alter table public.appointment_service
  add constraint appointment_service_no_overlap
  exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (is_active);

-- ---------------------------------------------------------------------------
-- attendance
-- ---------------------------------------------------------------------------
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company (id) on delete cascade,
  unit_id uuid not null references public.unit (id),
  client_id uuid not null references public.client (id),
  origin_appointment_id uuid references public.appointment (id),
  origin text not null check (origin in ('from_appointment', 'walk_in')),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists attendance_company_id_idx on public.attendance (company_id);
create index if not exists attendance_client_id_idx on public.attendance (client_id);

-- ---------------------------------------------------------------------------
-- attendance_item
-- ---------------------------------------------------------------------------
create table if not exists public.attendance_item (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance (id) on delete cascade,
  service_id uuid not null references public.service (id),
  professional_id uuid not null references public.professional (id),
  original_price numeric(10, 2) not null,
  discount numeric(10, 2) not null default 0,
  final_price numeric(10, 2) not null,
  type text not null default 'normal' check (type in ('normal', 'courtesy')),
  courtesy_reason text,
  planned_duration_minutes integer not null,
  started_at timestamptz,
  ended_at timestamptz,
  commission_percent_snapshot numeric(5, 2),
  commission_amount numeric(10, 2),
  created_at timestamptz not null default now()
);

create index if not exists attendance_item_attendance_id_idx on public.attendance_item (attendance_id);

-- Trava de imutabilidade: depois que o atendimento é concluído, os itens
-- não podem mais ser alterados ou removidos (preço/comissão já viraram
-- histórico financeiro).
create or replace function public.prevent_attendance_item_edit_after_completion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.attendance
  where id = coalesce(new.attendance_id, old.attendance_id);

  if v_status = 'completed' then
    raise exception 'Não é possível alterar itens de um atendimento já concluído.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_attendance_item_immutable on public.attendance_item;
create trigger trg_attendance_item_immutable
  before update or delete on public.attendance_item
  for each row execute function public.prevent_attendance_item_edit_after_completion();

-- ---------------------------------------------------------------------------
-- Grants — privilégio de tabela é só a primeira camada; o isolamento real
-- entre empresas é feito por Row Level Security na próxima migration.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select on public.role to authenticated;
grant select on public.company to authenticated;
grant select on public.user_company_role to authenticated;

grant select, insert on public.unit to authenticated;
grant select, insert, update on public.professional to authenticated;
grant select, insert, update on public.service to authenticated;
grant select, insert, delete on public.professional_service to authenticated;
grant select, insert, update on public.client to authenticated;
grant select, insert, update, delete on public.appointment to authenticated;
grant select, insert, update on public.appointment_service to authenticated;
grant select, insert, update on public.attendance to authenticated;
grant select, insert, update on public.attendance_item to authenticated;
