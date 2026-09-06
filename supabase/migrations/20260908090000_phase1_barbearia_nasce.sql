-- FADE OS — Fase 1: "A Barbearia Nasce"
--
-- Estende o schema existente (nunca substitui) para que o onboarding
-- consiga configurar uma barbearia real: identidade da empresa, unidade,
-- equipe (com separação entre identidade de acesso e profissional
-- operacional), serviços, produtos de venda, materiais de consumo, formas
-- de pagamento e a estrutura mínima para o caixa existir nas próximas
-- fases. Todas as instruções são aditivas e usam IF NOT EXISTS / DO blocks
-- condicionais — nenhuma tabela ou coluna existente é alterada ou perdida.

-- ---------------------------------------------------------------------------
-- company: identidade completa da barbearia
-- ---------------------------------------------------------------------------
alter table public.company
  add column if not exists whatsapp text,
  add column if not exists logo_url text,
  add column if not exists postal_code text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists onboarding_completed_at timestamptz;

-- ---------------------------------------------------------------------------
-- unit: status e configuração básica de funcionamento
-- ---------------------------------------------------------------------------
alter table public.unit
  add column if not exists phone text,
  add column if not exists status text not null default 'active',
  add column if not exists business_hours_note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'unit_status_check'
  ) then
    alter table public.unit
      add constraint unit_status_check check (status in ('active', 'inactive'));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- professional: função operacional (não confundir com role de acesso em
-- user_company_role), foto e unidade de vínculo.
-- ---------------------------------------------------------------------------
alter table public.professional
  add column if not exists avatar_url text,
  add column if not exists role_title text,
  add column if not exists unit_id uuid references public.unit (id);

-- Backfill: profissionais já cadastrados (antes desta migration) ganham a
-- unidade mais antiga da própria empresa, quando existir uma — nunca a
-- "primeira unidade encontrada" no banco todo, sempre da MESMA empresa do
-- profissional. Não força NOT NULL depois: uma empresa sem unidade ainda
-- (não deveria acontecer, mas não é este o lugar para essa garantia) não
-- pode travar a migration.
update public.professional p
set unit_id = u.id
from (
  select distinct on (company_id) company_id, id
  from public.unit
  order by company_id, created_at asc
) u
where p.unit_id is null
  and p.company_id = u.company_id;

create index if not exists professional_unit_id_idx on public.professional (unit_id);

-- Mesma regra de integridade cross-tenant do restante do schema: unit_id só
-- é aceito se pertencer à mesma empresa do profissional. unit_id é
-- opcional (nullable), então só valida quando de fato preenchido.
create or replace function public.check_professional_unit_same_company()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unit_company uuid;
begin
  if new.unit_id is null then
    return new;
  end if;

  select company_id into v_unit_company from public.unit where id = new.unit_id;
  if v_unit_company is null or v_unit_company <> new.company_id then
    raise exception 'A unidade do profissional precisa pertencer à mesma empresa.';
  end if;

  return new;
end;
$$;

revoke all on function public.check_professional_unit_same_company() from public;

drop trigger if exists trg_professional_unit_same_company on public.professional;
create trigger trg_professional_unit_same_company
  before insert or update on public.professional
  for each row execute function public.check_professional_unit_same_company();

-- ---------------------------------------------------------------------------
-- service: descrição (a categoria/preço/duração/comissão já existiam)
-- ---------------------------------------------------------------------------
alter table public.service
  add column if not exists description text;

-- ---------------------------------------------------------------------------
-- product: produto de venda (pomada, shampoo, bebida, acessório...) —
-- deliberadamente uma tabela própria, nunca misturada com material de
-- consumo (são conceitos diferentes: um é vendido ao cliente, o outro é
-- usado na operação).
-- ---------------------------------------------------------------------------
create table if not exists public.product (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company (id) on delete cascade,
  unit_id uuid not null references public.unit (id),
  name text not null,
  category text,
  cost_price numeric(10, 2) not null default 0,
  sale_price numeric(10, 2) not null default 0,
  current_stock numeric(10, 2) not null default 0,
  minimum_stock numeric(10, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists product_company_id_idx on public.product (company_id);
create index if not exists product_unit_id_idx on public.product (unit_id);

-- ---------------------------------------------------------------------------
-- consumable: material de consumo (lâmina, shampoo usado no atendimento,
-- talco, papel, luvas...) — tem custo mas nunca preço de venda ao cliente.
-- O consumo automático por atendimento é fora do escopo desta fase.
-- ---------------------------------------------------------------------------
create table if not exists public.consumable (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company (id) on delete cascade,
  unit_id uuid not null references public.unit (id),
  name text not null,
  category text,
  unit_of_measure text not null default 'un',
  cost_price numeric(10, 2) not null default 0,
  current_stock numeric(10, 2) not null default 0,
  minimum_stock numeric(10, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists consumable_company_id_idx on public.consumable (company_id);
create index if not exists consumable_unit_id_idx on public.consumable (unit_id);

-- Mesma regra de integridade cross-tenant já aplicada em appointment/
-- attendance: unit_id precisa pertencer à mesma empresa da linha.
create or replace function public.check_product_same_company()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unit_company uuid;
begin
  select company_id into v_unit_company from public.unit where id = new.unit_id;
  if v_unit_company is null or v_unit_company <> new.company_id then
    raise exception 'A unidade do produto precisa pertencer à mesma empresa.';
  end if;
  return new;
end;
$$;

revoke all on function public.check_product_same_company() from public;

drop trigger if exists trg_product_same_company on public.product;
create trigger trg_product_same_company
  before insert or update on public.product
  for each row execute function public.check_product_same_company();

create or replace function public.check_consumable_same_company()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unit_company uuid;
begin
  select company_id into v_unit_company from public.unit where id = new.unit_id;
  if v_unit_company is null or v_unit_company <> new.company_id then
    raise exception 'A unidade do material precisa pertencer à mesma empresa.';
  end if;
  return new;
end;
$$;

revoke all on function public.check_consumable_same_company() from public;

drop trigger if exists trg_consumable_same_company on public.consumable;
create trigger trg_consumable_same_company
  before insert or update on public.consumable
  for each row execute function public.check_consumable_same_company();

-- ---------------------------------------------------------------------------
-- payment_method: formas aceitas pela barbearia. Configuração de método,
-- não de checkout — nenhuma integração de pagamento é criada aqui.
-- ---------------------------------------------------------------------------
create table if not exists public.payment_method (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company (id) on delete cascade,
  method text not null check (
    method in ('cash', 'pix', 'debit', 'credit', 'credit_installments')
  ),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, method)
);

create index if not exists payment_method_company_id_idx on public.payment_method (company_id);

-- ---------------------------------------------------------------------------
-- cash_register: só a existência do caixa por unidade. Abertura, fechamento,
-- sangria, suprimento e reconciliação são de uma fase futura — aqui é só a
-- estrutura para o caixa "existir".
-- ---------------------------------------------------------------------------
create table if not exists public.cash_register (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company (id) on delete cascade,
  unit_id uuid not null references public.unit (id),
  name text not null default 'Caixa principal',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists cash_register_company_id_idx on public.cash_register (company_id);
create index if not exists cash_register_unit_id_idx on public.cash_register (unit_id);

create or replace function public.check_cash_register_same_company()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unit_company uuid;
begin
  select company_id into v_unit_company from public.unit where id = new.unit_id;
  if v_unit_company is null or v_unit_company <> new.company_id then
    raise exception 'A unidade do caixa precisa pertencer à mesma empresa.';
  end if;
  return new;
end;
$$;

revoke all on function public.check_cash_register_same_company() from public;

drop trigger if exists trg_cash_register_same_company on public.cash_register;
create trigger trg_cash_register_same_company
  before insert or update on public.cash_register
  for each row execute function public.check_cash_register_same_company();

-- ---------------------------------------------------------------------------
-- RLS: mesmo padrão de isolamento por company_id das tabelas existentes.
-- ---------------------------------------------------------------------------
alter table public.product enable row level security;
alter table public.consumable enable row level security;
alter table public.payment_method enable row level security;
alter table public.cash_register enable row level security;

drop policy if exists product_select on public.product;
create policy product_select on public.product
  for select to authenticated
  using (company_id in (select public.my_company_ids()));

drop policy if exists product_insert on public.product;
create policy product_insert on public.product
  for insert to authenticated
  with check (company_id in (select public.my_company_ids()));

drop policy if exists product_update on public.product;
create policy product_update on public.product
  for update to authenticated
  using (company_id in (select public.my_company_ids()))
  with check (company_id in (select public.my_company_ids()));

drop policy if exists consumable_select on public.consumable;
create policy consumable_select on public.consumable
  for select to authenticated
  using (company_id in (select public.my_company_ids()));

drop policy if exists consumable_insert on public.consumable;
create policy consumable_insert on public.consumable
  for insert to authenticated
  with check (company_id in (select public.my_company_ids()));

drop policy if exists consumable_update on public.consumable;
create policy consumable_update on public.consumable
  for update to authenticated
  using (company_id in (select public.my_company_ids()))
  with check (company_id in (select public.my_company_ids()));

drop policy if exists payment_method_select on public.payment_method;
create policy payment_method_select on public.payment_method
  for select to authenticated
  using (company_id in (select public.my_company_ids()));

drop policy if exists payment_method_insert on public.payment_method;
create policy payment_method_insert on public.payment_method
  for insert to authenticated
  with check (company_id in (select public.my_company_ids()));

drop policy if exists payment_method_update on public.payment_method;
create policy payment_method_update on public.payment_method
  for update to authenticated
  using (company_id in (select public.my_company_ids()))
  with check (company_id in (select public.my_company_ids()));

drop policy if exists cash_register_select on public.cash_register;
create policy cash_register_select on public.cash_register
  for select to authenticated
  using (company_id in (select public.my_company_ids()));

drop policy if exists cash_register_insert on public.cash_register;
create policy cash_register_insert on public.cash_register
  for insert to authenticated
  with check (company_id in (select public.my_company_ids()));

-- ---------------------------------------------------------------------------
-- unit/professional/company: policies de UPDATE que ainda não existiam
-- (a migration de tenancy original só cobria select/insert para unit, e só
-- select/insert/update já cobria professional — mantido; company também
-- precisa de UPDATE agora que o onboarding edita logo/whatsapp/endereço
-- depois de criada).
-- ---------------------------------------------------------------------------
drop policy if exists unit_update on public.unit;
create policy unit_update on public.unit
  for update to authenticated
  using (company_id in (select public.my_company_ids()))
  with check (company_id in (select public.my_company_ids()));

drop policy if exists company_update on public.company;
create policy company_update on public.company
  for update to authenticated
  using (id in (select public.my_company_ids()))
  with check (id in (select public.my_company_ids()));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant update on public.company to authenticated;
grant update on public.unit to authenticated;
grant select, insert, update on public.product to authenticated;
grant select, insert, update on public.consumable to authenticated;
grant select, insert, update on public.payment_method to authenticated;
grant select, insert on public.cash_register to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: bucket público de avatars/logos (logo da empresa, foto do
-- profissional). Leitura pública (para aparecerem em telas futuras
-- voltadas ao cliente final), escrita restrita a quem tem acesso à empresa
-- dona do arquivo — o caminho do objeto sempre começa com o company_id,
-- então a policy de escrita valida o primeiro segmento do path contra
-- my_company_ids().
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select to public
  using (bucket_id = 'avatars');

drop policy if exists avatars_company_write on storage.objects;
create policy avatars_company_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1]::uuid in (select public.my_company_ids())
  );

drop policy if exists avatars_company_update on storage.objects;
create policy avatars_company_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1]::uuid in (select public.my_company_ids())
  );
