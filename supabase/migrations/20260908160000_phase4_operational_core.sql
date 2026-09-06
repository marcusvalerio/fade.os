-- FADE OS — Fase 4: "Gestão + Inteligência", parte A — schema operacional.
--
-- Aditiva sobre o schema real (Fases 1-3 preservadas intocadas). Cobre a
-- cadeia CLIENTE→ATENDIMENTO→ITENS→VENDA→PAGAMENTO→CAIXA/ESTOQUE/
-- COMISSÃO/FINANCEIRO/CRM. Nenhuma tabela nova precisa de acesso `anon` —
-- diferente da Fase 3, tudo aqui é operação interna autenticada, então RLS
-- comum (`company_id in (select my_company_ids())`) é suficiente; não há
-- necessidade de SECURITY DEFINER para leitura/escrita simples (só as
-- funções de orquestração atômica da parte B usam SECURITY INVOKER, que
-- roda com o privilégio de quem chama — RLS continua sendo a barreira
-- real, exatamente como get_available_slots na Fase 2).
--
-- Descoberta ao inspecionar o schema antes de alterar (seção 22): não
-- existe nenhuma tabela sale/payment/commission/stock_movement/cash_
-- session/financial_entry/audit_log — o README já documentava que uma
-- automação de comissão antiga (005_sale_and_commission) foi removida
-- numa limpeza anterior; esta fase implementa o domínio do zero, sem
-- recriar objetos mortos. `attendance`/`attendance_item` já existem (Fase
-- 1) com os campos de cronômetro (`started_at`/`ended_at`) e comissão
-- (`commission_percent_snapshot`/`commission_amount`) já presentes —
-- reaproveitados aqui, não duplicados.

-- =============================================================================
-- PARTE 1 — attendance_item vira polimórfico (serviço OU produto)
-- =============================================================================
-- Alterações aditivas: novas colunas + soltar NOT NULL de service_id/
-- professional_id/planned_duration_minutes (só fazem sentido para
-- kind='service'). Nenhuma linha existente é afetada — todas já têm
-- kind='service' via o default abaixo.

alter table public.attendance_item add column if not exists kind text not null default 'service';
alter table public.attendance_item add column if not exists product_id uuid references public.product(id);
alter table public.attendance_item add column if not exists quantity numeric not null default 1;

alter table public.attendance_item alter column service_id drop not null;
alter table public.attendance_item alter column professional_id drop not null;
alter table public.attendance_item alter column planned_duration_minutes drop not null;

alter table public.attendance_item drop constraint if exists attendance_item_kind_check;
alter table public.attendance_item add constraint attendance_item_kind_check
  check (kind in ('service', 'product'));

alter table public.attendance_item drop constraint if exists attendance_item_quantity_check;
alter table public.attendance_item add constraint attendance_item_quantity_check
  check (quantity > 0);

alter table public.attendance_item drop constraint if exists attendance_item_kind_fields_check;
alter table public.attendance_item add constraint attendance_item_kind_fields_check
  check (
    (kind = 'service' and service_id is not null and professional_id is not null and product_id is null)
    or
    (kind = 'product' and product_id is not null and service_id is null)
  );

-- Substitui a validação cross-tenant para lidar com os campos agora
-- opcionais e o novo product_id (mesma disciplina de
-- check_professional_unit_same_company / check_appointment_service_same_company
-- já usada nas fases anteriores: cada FK presente precisa apontar para a
-- mesma empresa do atendimento).
create or replace function public.check_attendance_item_same_company()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_attendance_company uuid;
  v_service_company uuid;
  v_professional_company uuid;
  v_product_company uuid;
begin
  select company_id into v_attendance_company from public.attendance where id = new.attendance_id;
  if v_attendance_company is null then
    raise exception 'Atendimento não encontrado para este item.';
  end if;

  if new.service_id is not null then
    select company_id into v_service_company from public.service where id = new.service_id;
    if v_service_company is null or v_service_company <> v_attendance_company then
      raise exception 'Serviço precisa pertencer à mesma empresa do atendimento.';
    end if;
  end if;

  if new.professional_id is not null then
    select company_id into v_professional_company from public.professional where id = new.professional_id;
    if v_professional_company is null or v_professional_company <> v_attendance_company then
      raise exception 'Profissional precisa pertencer à mesma empresa do atendimento.';
    end if;
  end if;

  if new.product_id is not null then
    select company_id into v_product_company from public.product where id = new.product_id;
    if v_product_company is null or v_product_company <> v_attendance_company then
      raise exception 'Produto precisa pertencer à mesma empresa do atendimento.';
    end if;
  end if;

  return new;
end;
$$;

-- =============================================================================
-- PARTE 2 — VENDA / ITENS DE VENDA
-- =============================================================================

create table if not exists public.sale (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  unit_id uuid not null references public.unit(id) on delete cascade,
  client_id uuid not null references public.client(id),
  attendance_id uuid references public.attendance(id),
  status text not null default 'completed' check (status in ('completed', 'cancelled')),
  subtotal numeric not null default 0,
  discount_amount numeric not null default 0 check (discount_amount >= 0),
  surcharge_amount numeric not null default 0 check (surcharge_amount >= 0),
  total numeric not null default 0,
  created_by uuid,
  cancelled_at timestamptz,
  cancelled_reason text,
  cancelled_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sale_company_created_idx on public.sale (company_id, created_at);
create index if not exists sale_attendance_idx on public.sale (attendance_id);
create index if not exists sale_client_idx on public.sale (client_id);

create table if not exists public.sale_item (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sale(id) on delete cascade,
  company_id uuid not null references public.company(id) on delete cascade,
  kind text not null check (kind in ('service', 'product')),
  service_id uuid references public.service(id),
  product_id uuid references public.product(id),
  attendance_item_id uuid references public.attendance_item(id),
  professional_id uuid references public.professional(id),
  quantity numeric not null default 1 check (quantity > 0),
  unit_price numeric not null default 0,
  discount numeric not null default 0 check (discount >= 0),
  is_courtesy boolean not null default false,
  total numeric not null default 0,
  created_at timestamptz not null default now(),
  constraint sale_item_kind_fields_check check (
    (kind = 'service' and service_id is not null and product_id is null)
    or
    (kind = 'product' and product_id is not null and service_id is null)
  )
);

create index if not exists sale_item_sale_idx on public.sale_item (sale_id);
create index if not exists sale_item_company_idx on public.sale_item (company_id);
create index if not exists sale_item_professional_idx on public.sale_item (professional_id);

-- =============================================================================
-- PARTE 3 — PAGAMENTO
-- =============================================================================

create table if not exists public.payment (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  sale_id uuid not null references public.sale(id) on delete cascade,
  method text not null check (method in ('cash', 'pix', 'debit', 'credit', 'credit_installments')),
  amount numeric not null check (amount > 0),
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'cancelled', 'refunded')),
  reference text,
  cash_session_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  refunded_at timestamptz,
  refunded_reason text,
  refunded_by uuid
);

create index if not exists payment_sale_idx on public.payment (sale_id);
create index if not exists payment_company_created_idx on public.payment (company_id, created_at);
create index if not exists payment_cash_session_idx on public.payment (cash_session_id);

-- =============================================================================
-- PARTE 4 — CAIXA (abertura/fechamento real, além da estrutura da Fase 1)
-- =============================================================================

create table if not exists public.cash_session (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  cash_register_id uuid not null references public.cash_register(id) on delete cascade,
  unit_id uuid not null references public.unit(id) on delete cascade,
  opened_by uuid not null,
  opened_at timestamptz not null default now(),
  opening_balance numeric not null default 0 check (opening_balance >= 0),
  closed_by uuid,
  closed_at timestamptz,
  expected_balance numeric,
  counted_balance numeric,
  difference numeric,
  status text not null default 'open' check (status in ('open', 'closed')),
  notes text
);

create unique index if not exists cash_session_one_open_per_register
  on public.cash_session (cash_register_id)
  where (status = 'open');

create index if not exists cash_session_company_idx on public.cash_session (company_id, opened_at);

create table if not exists public.cash_movement (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  cash_session_id uuid not null references public.cash_session(id) on delete cascade,
  type text not null check (type in ('sale_payment', 'sangria', 'suprimento', 'other_in', 'other_out')),
  amount numeric not null check (amount > 0),
  method text,
  reference_type text,
  reference_id uuid,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists cash_movement_session_idx on public.cash_movement (cash_session_id);
create index if not exists cash_movement_company_idx on public.cash_movement (company_id, created_at);

alter table public.payment
  drop constraint if exists payment_cash_session_id_fkey,
  add constraint payment_cash_session_id_fkey foreign key (cash_session_id) references public.cash_session(id);

-- =============================================================================
-- PARTE 5 — COMISSÃO
-- =============================================================================

create table if not exists public.commission (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  sale_item_id uuid not null references public.sale_item(id) on delete cascade,
  professional_id uuid not null references public.professional(id),
  base_amount numeric not null,
  percent numeric not null default 0,
  amount numeric not null default 0,
  status text not null default 'due' check (status in ('predicted', 'due', 'paid', 'reversed')),
  paid_at timestamptz,
  paid_by uuid,
  reversed_at timestamptz,
  reversed_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commission_professional_idx on public.commission (professional_id, created_at);
create index if not exists commission_company_idx on public.commission (company_id, created_at);
create index if not exists commission_sale_item_idx on public.commission (sale_item_id);

-- =============================================================================
-- PARTE 6 — ESTOQUE (movimentação real, produto e consumo)
-- =============================================================================

create table if not exists public.stock_movement (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  unit_id uuid not null references public.unit(id) on delete cascade,
  item_type text not null check (item_type in ('product', 'consumable')),
  product_id uuid references public.product(id),
  consumable_id uuid references public.consumable(id),
  movement_type text not null check (movement_type in ('entry', 'sale', 'consumption', 'adjustment', 'loss', 'inventory')),
  quantity numeric not null check (quantity <> 0),
  unit_cost numeric,
  reference_type text,
  reference_id uuid,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint stock_movement_item_fields_check check (
    (item_type = 'product' and product_id is not null and consumable_id is null)
    or
    (item_type = 'consumable' and consumable_id is not null and product_id is null)
  )
);

create index if not exists stock_movement_company_idx on public.stock_movement (company_id, created_at);
create index if not exists stock_movement_product_idx on public.stock_movement (product_id);
create index if not exists stock_movement_consumable_idx on public.stock_movement (consumable_id);

-- =============================================================================
-- PARTE 7 — FINANCEIRO
-- =============================================================================

create table if not exists public.financial_entry (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  unit_id uuid references public.unit(id),
  type text not null check (type in ('income', 'expense')),
  category text not null,
  description text,
  amount numeric not null check (amount > 0),
  quantity numeric,
  unit_cost numeric,
  supplier text,
  reference_type text,
  reference_id uuid,
  entry_date date not null default current_date,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists financial_entry_company_date_idx on public.financial_entry (company_id, entry_date);
create index if not exists financial_entry_type_idx on public.financial_entry (company_id, type, entry_date);

-- =============================================================================
-- PARTE 8 — CRM (comportamento) + CAMPANHA
-- =============================================================================

alter table public.client add column if not exists tags text[] not null default '{}';

create table if not exists public.campaign (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  name text not null,
  objective text,
  audience_filter jsonb not null default '{}'::jsonb,
  message text,
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'sms', 'email', 'other')),
  period_start date,
  period_end date,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'completed')),
  responsible_id uuid,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaign_company_idx on public.campaign (company_id, status);

-- =============================================================================
-- PARTE 9 — AUDITORIA
-- =============================================================================

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_company_idx on public.audit_log (company_id, created_at);
create index if not exists audit_log_entity_idx on public.audit_log (entity_type, entity_id);

-- =============================================================================
-- PARTE 10 — TRIGGERS DE INTEGRIDADE CROSS-TENANT
-- =============================================================================

create or replace function public.check_sale_same_company()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  v_unit_company uuid;
  v_client_company uuid;
  v_attendance_company uuid;
begin
  select company_id into v_unit_company from public.unit where id = new.unit_id;
  select company_id into v_client_company from public.client where id = new.client_id;
  if v_unit_company is null or v_unit_company <> new.company_id
     or v_client_company is null or v_client_company <> new.company_id then
    raise exception 'Unidade e cliente precisam pertencer à mesma empresa da venda.';
  end if;
  if new.attendance_id is not null then
    select company_id into v_attendance_company from public.attendance where id = new.attendance_id;
    if v_attendance_company is null or v_attendance_company <> new.company_id then
      raise exception 'Atendimento de origem precisa pertencer à mesma empresa da venda.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sale_same_company on public.sale;
create trigger trg_sale_same_company
  before insert or update on public.sale
  for each row execute function public.check_sale_same_company();

create or replace function public.check_sale_item_same_company()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  v_sale_company uuid;
  v_service_company uuid;
  v_product_company uuid;
  v_professional_company uuid;
begin
  select company_id into v_sale_company from public.sale where id = new.sale_id;
  if v_sale_company is null or v_sale_company <> new.company_id then
    raise exception 'Item precisa pertencer à mesma empresa da venda.';
  end if;
  if new.service_id is not null then
    select company_id into v_service_company from public.service where id = new.service_id;
    if v_service_company is null or v_service_company <> new.company_id then
      raise exception 'Serviço precisa pertencer à mesma empresa da venda.';
    end if;
  end if;
  if new.product_id is not null then
    select company_id into v_product_company from public.product where id = new.product_id;
    if v_product_company is null or v_product_company <> new.company_id then
      raise exception 'Produto precisa pertencer à mesma empresa da venda.';
    end if;
  end if;
  if new.professional_id is not null then
    select company_id into v_professional_company from public.professional where id = new.professional_id;
    if v_professional_company is null or v_professional_company <> new.company_id then
      raise exception 'Profissional precisa pertencer à mesma empresa da venda.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sale_item_same_company on public.sale_item;
create trigger trg_sale_item_same_company
  before insert or update on public.sale_item
  for each row execute function public.check_sale_item_same_company();

create or replace function public.check_payment_same_company()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  v_sale_company uuid;
  v_session_company uuid;
begin
  select company_id into v_sale_company from public.sale where id = new.sale_id;
  if v_sale_company is null or v_sale_company <> new.company_id then
    raise exception 'Venda precisa pertencer à mesma empresa do pagamento.';
  end if;
  if new.cash_session_id is not null then
    select company_id into v_session_company from public.cash_session where id = new.cash_session_id;
    if v_session_company is null or v_session_company <> new.company_id then
      raise exception 'Caixa precisa pertencer à mesma empresa do pagamento.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_payment_same_company on public.payment;
create trigger trg_payment_same_company
  before insert or update on public.payment
  for each row execute function public.check_payment_same_company();

create or replace function public.check_commission_same_company()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  v_item_company uuid;
  v_professional_company uuid;
begin
  select company_id into v_item_company from public.sale_item where id = new.sale_item_id;
  select company_id into v_professional_company from public.professional where id = new.professional_id;
  if v_item_company is null or v_item_company <> new.company_id
     or v_professional_company is null or v_professional_company <> new.company_id then
    raise exception 'Item de venda e profissional precisam pertencer à mesma empresa da comissão.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_commission_same_company on public.commission;
create trigger trg_commission_same_company
  before insert or update on public.commission
  for each row execute function public.check_commission_same_company();

create or replace function public.check_stock_movement_same_company()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  v_unit_company uuid;
  v_product_company uuid;
  v_consumable_company uuid;
begin
  select company_id into v_unit_company from public.unit where id = new.unit_id;
  if v_unit_company is null or v_unit_company <> new.company_id then
    raise exception 'Unidade precisa pertencer à mesma empresa da movimentação.';
  end if;
  if new.product_id is not null then
    select company_id into v_product_company from public.product where id = new.product_id;
    if v_product_company is null or v_product_company <> new.company_id then
      raise exception 'Produto precisa pertencer à mesma empresa da movimentação.';
    end if;
  end if;
  if new.consumable_id is not null then
    select company_id into v_consumable_company from public.consumable where id = new.consumable_id;
    if v_consumable_company is null or v_consumable_company <> new.company_id then
      raise exception 'Material precisa pertencer à mesma empresa da movimentação.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stock_movement_same_company on public.stock_movement;
create trigger trg_stock_movement_same_company
  before insert or update on public.stock_movement
  for each row execute function public.check_stock_movement_same_company();

create or replace function public.check_cash_session_same_company()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  v_register_company uuid;
  v_unit_company uuid;
begin
  select company_id into v_register_company from public.cash_register where id = new.cash_register_id;
  select company_id into v_unit_company from public.unit where id = new.unit_id;
  if v_register_company is null or v_register_company <> new.company_id
     or v_unit_company is null or v_unit_company <> new.company_id then
    raise exception 'Caixa e unidade precisam pertencer à mesma empresa da sessão.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cash_session_same_company on public.cash_session;
create trigger trg_cash_session_same_company
  before insert or update on public.cash_session
  for each row execute function public.check_cash_session_same_company();

create or replace function public.check_cash_movement_same_company()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  v_session_company uuid;
begin
  select company_id into v_session_company from public.cash_session where id = new.cash_session_id;
  if v_session_company is null or v_session_company <> new.company_id then
    raise exception 'Sessão de caixa precisa pertencer à mesma empresa da movimentação.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cash_movement_same_company on public.cash_movement;
create trigger trg_cash_movement_same_company
  before insert or update on public.cash_movement
  for each row execute function public.check_cash_movement_same_company();

-- =============================================================================
-- PARTE 11 — RLS
-- =============================================================================

alter table public.sale enable row level security;
alter table public.sale_item enable row level security;
alter table public.payment enable row level security;
alter table public.cash_session enable row level security;
alter table public.cash_movement enable row level security;
alter table public.commission enable row level security;
alter table public.stock_movement enable row level security;
alter table public.financial_entry enable row level security;
alter table public.campaign enable row level security;
alter table public.audit_log enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'sale', 'sale_item', 'payment', 'cash_session', 'cash_movement',
    'commission', 'stock_movement', 'financial_entry', 'campaign', 'audit_log'
  ] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format(
      'create policy %I_select on public.%I for select to authenticated using (company_id in (select public.my_company_ids()))',
      t, t
    );
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format(
      'create policy %I_insert on public.%I for insert to authenticated with check (company_id in (select public.my_company_ids()))',
      t, t
    );
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format(
      'create policy %I_update on public.%I for update to authenticated using (company_id in (select public.my_company_ids())) with check (company_id in (select public.my_company_ids()))',
      t, t
    );
  end loop;
end;
$$;

-- audit_log é somente-leitura pela aplicação (a escrita acontece sempre
-- via public.write_audit_log(), SECURITY INVOKER, na parte B) — mas como a
-- policy de insert acima já restringe por company_id, mantê-la não é um
-- risco: só permite inserir auditoria da própria empresa, nunca de outra.

grant select, insert, update on public.sale, public.sale_item, public.payment,
  public.cash_session, public.cash_movement, public.commission, public.stock_movement,
  public.financial_entry, public.campaign, public.audit_log
  to authenticated;
