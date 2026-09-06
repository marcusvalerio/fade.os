-- FADE OS — Fase 2: Motor de Disponibilidade
--
-- Constrói, sobre o que a Fase 1 já criou (professional, service,
-- professional_service, unit, appointment/appointment_service), a estrutura
-- e a função que respondem "quais horários um serviço pode ser realizado
-- por um profissional, numa unidade, numa data?" — com jornada, intervalos,
-- bloqueios, ausências e agendamentos existentes, não uma lista estática.
--
-- Só aditivo: nenhuma tabela/coluna existente é alterada ou removida.
--
-- (A migration 20260908120000_phase2_availability_engine foi aplicada por
-- engano com um corpo vazio/placeholder — fica registrada no histórico como
-- um no-op inofensivo; esta migration é o conteúdo real.)

-- ---------------------------------------------------------------------------
-- professional_schedule: jornada semanal do profissional. Uma linha por
-- (profissional, dia da semana) — o dia sem linha, ou com active=false,
-- significa "não trabalha nesse dia" (ex.: domingo).
--
-- weekday usa a mesma convenção de extract(dow from date) do Postgres:
-- 0=domingo, 1=segunda, ..., 6=sábado — para a função de disponibilidade
-- nunca precisar reindexar.
-- ---------------------------------------------------------------------------
create table if not exists public.professional_schedule (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint professional_schedule_time_order check (end_time > start_time),
  unique (professional_id, weekday)
);

create index if not exists professional_schedule_professional_id_idx
  on public.professional_schedule (professional_id);

-- ---------------------------------------------------------------------------
-- professional_schedule_break: intervalos (almoço etc.) dentro do dia de
-- trabalho — zero ou mais por dia, nunca "bloqueado no frontend": o motor
-- de disponibilidade precisa saber disso para nunca oferecer aquele
-- horário, não é um detalhe visual.
-- ---------------------------------------------------------------------------
create table if not exists public.professional_schedule_break (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.professional_schedule (id) on delete cascade,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  constraint professional_schedule_break_time_order check (end_time > start_time)
);

create index if not exists professional_schedule_break_schedule_id_idx
  on public.professional_schedule_break (schedule_id);

-- ---------------------------------------------------------------------------
-- unit_business_hours: jornada de funcionamento da unidade. A disponibilidade
-- real de um profissional nunca ultrapassa isto — é a interseção entre a
-- jornada do profissional e o funcionamento da unidade, nunca só uma delas.
-- Mesma convenção de weekday do professional_schedule.
-- ---------------------------------------------------------------------------
create table if not exists public.unit_business_hours (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.unit (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint unit_business_hours_time_order check (end_time > start_time),
  unique (unit_id, weekday)
);

create index if not exists unit_business_hours_unit_id_idx
  on public.unit_business_hours (unit_id);

-- ---------------------------------------------------------------------------
-- professional_block: bloqueios temporários e pontuais (reunião, compromisso,
-- manutenção, bloqueio manual) — timestamptz porque são ocorrências únicas
-- com início/fim reais, não recorrentes como a jornada semanal.
-- ---------------------------------------------------------------------------
create table if not exists public.professional_block (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional (id) on delete cascade,
  unit_id uuid references public.unit (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint professional_block_time_order check (ends_at > starts_at)
);

create index if not exists professional_block_professional_id_idx
  on public.professional_block (professional_id);
create index if not exists professional_block_range_idx
  on public.professional_block using gist (professional_id, tstzrange(starts_at, ends_at))
  where (status = 'active');

-- ---------------------------------------------------------------------------
-- professional_absence: férias, folga excepcional, afastamento, feriado
-- individual — pode ser um período longo (férias) ou um intervalo específico
-- dentro de um dia; timestamptz cobre os dois casos sem precisar de duas
-- tabelas diferentes.
-- ---------------------------------------------------------------------------
create table if not exists public.professional_absence (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  type text not null default 'other' check (
    type in ('vacation', 'day_off', 'leave', 'holiday', 'other')
  ),
  reason text,
  created_at timestamptz not null default now(),
  constraint professional_absence_time_order check (ends_at > starts_at)
);

create index if not exists professional_absence_professional_id_idx
  on public.professional_absence (professional_id);

-- ---------------------------------------------------------------------------
-- RLS — mesmo padrão já usado em professional_service/attendance_item:
-- a tabela não guarda company_id próprio, o acesso é validado via EXISTS
-- contra o professional/unit dono da linha, que por sua vez já é scoped por
-- company_id. A policy de INSERT/UPDATE é o que efetivamente impede
-- referenciar um professional_id/unit_id de outra empresa — não existe
-- atalho de "não precisa checar, é só configuração".
-- ---------------------------------------------------------------------------
alter table public.professional_schedule enable row level security;
alter table public.professional_schedule_break enable row level security;
alter table public.unit_business_hours enable row level security;
alter table public.professional_block enable row level security;
alter table public.professional_absence enable row level security;

drop policy if exists professional_schedule_select on public.professional_schedule;
create policy professional_schedule_select on public.professional_schedule
  for select to authenticated
  using (exists (
    select 1 from public.professional p
    where p.id = professional_schedule.professional_id
      and p.company_id in (select public.my_company_ids())
  ));

drop policy if exists professional_schedule_insert on public.professional_schedule;
create policy professional_schedule_insert on public.professional_schedule
  for insert to authenticated
  with check (exists (
    select 1 from public.professional p
    where p.id = professional_schedule.professional_id
      and p.company_id in (select public.my_company_ids())
  ));

drop policy if exists professional_schedule_update on public.professional_schedule;
create policy professional_schedule_update on public.professional_schedule
  for update to authenticated
  using (exists (
    select 1 from public.professional p
    where p.id = professional_schedule.professional_id
      and p.company_id in (select public.my_company_ids())
  ))
  with check (exists (
    select 1 from public.professional p
    where p.id = professional_schedule.professional_id
      and p.company_id in (select public.my_company_ids())
  ));

drop policy if exists professional_schedule_delete on public.professional_schedule;
create policy professional_schedule_delete on public.professional_schedule
  for delete to authenticated
  using (exists (
    select 1 from public.professional p
    where p.id = professional_schedule.professional_id
      and p.company_id in (select public.my_company_ids())
  ));

drop policy if exists professional_schedule_break_select on public.professional_schedule_break;
create policy professional_schedule_break_select on public.professional_schedule_break
  for select to authenticated
  using (exists (
    select 1 from public.professional_schedule s
    join public.professional p on p.id = s.professional_id
    where s.id = professional_schedule_break.schedule_id
      and p.company_id in (select public.my_company_ids())
  ));

drop policy if exists professional_schedule_break_insert on public.professional_schedule_break;
create policy professional_schedule_break_insert on public.professional_schedule_break
  for insert to authenticated
  with check (exists (
    select 1 from public.professional_schedule s
    join public.professional p on p.id = s.professional_id
    where s.id = professional_schedule_break.schedule_id
      and p.company_id in (select public.my_company_ids())
  ));

drop policy if exists professional_schedule_break_delete on public.professional_schedule_break;
create policy professional_schedule_break_delete on public.professional_schedule_break
  for delete to authenticated
  using (exists (
    select 1 from public.professional_schedule s
    join public.professional p on p.id = s.professional_id
    where s.id = professional_schedule_break.schedule_id
      and p.company_id in (select public.my_company_ids())
  ));

drop policy if exists unit_business_hours_select on public.unit_business_hours;
create policy unit_business_hours_select on public.unit_business_hours
  for select to authenticated
  using (exists (
    select 1 from public.unit u
    where u.id = unit_business_hours.unit_id
      and u.company_id in (select public.my_company_ids())
  ));

drop policy if exists unit_business_hours_insert on public.unit_business_hours;
create policy unit_business_hours_insert on public.unit_business_hours
  for insert to authenticated
  with check (exists (
    select 1 from public.unit u
    where u.id = unit_business_hours.unit_id
      and u.company_id in (select public.my_company_ids())
  ));

drop policy if exists unit_business_hours_update on public.unit_business_hours;
create policy unit_business_hours_update on public.unit_business_hours
  for update to authenticated
  using (exists (
    select 1 from public.unit u
    where u.id = unit_business_hours.unit_id
      and u.company_id in (select public.my_company_ids())
  ))
  with check (exists (
    select 1 from public.unit u
    where u.id = unit_business_hours.unit_id
      and u.company_id in (select public.my_company_ids())
  ));

drop policy if exists professional_block_select on public.professional_block;
create policy professional_block_select on public.professional_block
  for select to authenticated
  using (exists (
    select 1 from public.professional p
    where p.id = professional_block.professional_id
      and p.company_id in (select public.my_company_ids())
  ));

drop policy if exists professional_block_insert on public.professional_block;
create policy professional_block_insert on public.professional_block
  for insert to authenticated
  with check (exists (
    select 1 from public.professional p
    where p.id = professional_block.professional_id
      and p.company_id in (select public.my_company_ids())
  ));

drop policy if exists professional_block_update on public.professional_block;
create policy professional_block_update on public.professional_block
  for update to authenticated
  using (exists (
    select 1 from public.professional p
    where p.id = professional_block.professional_id
      and p.company_id in (select public.my_company_ids())
  ))
  with check (exists (
    select 1 from public.professional p
    where p.id = professional_block.professional_id
      and p.company_id in (select public.my_company_ids())
  ));

drop policy if exists professional_absence_select on public.professional_absence;
create policy professional_absence_select on public.professional_absence
  for select to authenticated
  using (exists (
    select 1 from public.professional p
    where p.id = professional_absence.professional_id
      and p.company_id in (select public.my_company_ids())
  ));

drop policy if exists professional_absence_insert on public.professional_absence;
create policy professional_absence_insert on public.professional_absence
  for insert to authenticated
  with check (exists (
    select 1 from public.professional p
    where p.id = professional_absence.professional_id
      and p.company_id in (select public.my_company_ids())
  ));

drop policy if exists professional_absence_delete on public.professional_absence;
create policy professional_absence_delete on public.professional_absence
  for delete to authenticated
  using (exists (
    select 1 from public.professional p
    where p.id = professional_absence.professional_id
      and p.company_id in (select public.my_company_ids())
  ));

grant select, insert, update, delete on public.professional_schedule to authenticated;
grant select, insert, delete on public.professional_schedule_break to authenticated;
grant select, insert, update on public.unit_business_hours to authenticated;
grant select, insert, update on public.professional_block to authenticated;
grant select, insert, delete on public.professional_absence to authenticated;

-- ---------------------------------------------------------------------------
-- get_available_slots: o motor. SECURITY INVOKER (não DEFINER) de propósito
-- — ele só lê o que RLS já deixaria o chamador ler, então nunca pode
-- vazar dado cross-tenant mesmo que company_id/unit_id venham "errados" do
-- cliente: se o usuário não pertence àquela empresa, as subconsultas em
-- service/unit/professional simplesmente não retornam nada (RLS), e a
-- função devolve zero horários — não um erro que revele que a empresa existe.
--
-- v_slot_step_minutes é a ÚNICA definição da granularidade de geração de
-- slots do sistema inteiro (seção 8 do pedido) — nenhum outro lugar do
-- código deve hardcodar esse número.
-- ---------------------------------------------------------------------------
create or replace function public.get_available_slots(
  p_company_id uuid,
  p_unit_id uuid,
  p_service_id uuid,
  p_date date,
  p_professional_id uuid default null
)
returns table (
  professional_id uuid,
  professional_name text,
  slot_start timestamptz,
  slot_end timestamptz
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_duration_minutes int;
  v_slot_step_minutes constant int := 15;
  -- "date + time" é interpretado no timezone da SESSÃO (UTC no Postgres do
  -- Supabase), não no horário local da barbearia — sem ancorar
  -- explicitamente a este fuso, toda jornada ficaria deslocada em relação
  -- aos appointment_service.starts_at reais (esses sim, timestamptz
  -- corretos, gerados a partir de datetime-local do navegador). Fase 2 não
  -- tem (ainda) fuso por empresa/unidade configurável — é uma simplificação
  -- deliberada de MVP para um produto hoje inteiramente pt-BR, não um bug
  -- escondido; a próxima fase que precisar de multi-fuso troca esta única
  -- constante por uma coluna em company/unit.
  v_business_timezone constant text := 'America/Sao_Paulo';
  v_weekday int;
  v_unit_has_hours boolean;
begin
  select planned_duration_minutes into v_duration_minutes
  from public.service
  where id = p_service_id and company_id = p_company_id and status = 'active';

  if v_duration_minutes is null then
    return;
  end if;

  if not exists (
    select 1 from public.unit where id = p_unit_id and company_id = p_company_id
  ) then
    return;
  end if;

  v_weekday := extract(dow from p_date)::int;

  select true into v_unit_has_hours
  from public.unit_business_hours
  where unit_id = p_unit_id and weekday = v_weekday and active
  limit 1;

  if v_unit_has_hours is not true then
    return;
  end if;

  return query
  with eligible_professionals as (
    select p.id, p.name
    from public.professional p
    join public.professional_service ps
      on ps.professional_id = p.id and ps.service_id = p_service_id
    where p.company_id = p_company_id
      and p.active
      and (p_professional_id is null or p.id = p_professional_id)
      and (p.unit_id is null or p.unit_id = p_unit_id)
  ),
  professional_windows as (
    select
      ep.id as professional_id,
      ep.name as professional_name,
      psch.id as schedule_id,
      greatest(psch.start_time, ubh.start_time) as window_start,
      least(psch.end_time, ubh.end_time) as window_end
    from eligible_professionals ep
    join public.professional_schedule psch
      on psch.professional_id = ep.id and psch.weekday = v_weekday and psch.active
    join public.unit_business_hours ubh
      on ubh.unit_id = p_unit_id and ubh.weekday = v_weekday and ubh.active
    where greatest(psch.start_time, ubh.start_time) < least(psch.end_time, ubh.end_time)
  ),
  candidate_slots as (
    select
      pw.professional_id,
      pw.professional_name,
      pw.schedule_id,
      (((p_date + pw.window_start) at time zone v_business_timezone)
        + (n * v_slot_step_minutes) * interval '1 minute') as slot_start,
      (((p_date + pw.window_start) at time zone v_business_timezone)
        + (n * v_slot_step_minutes) * interval '1 minute'
        + v_duration_minutes * interval '1 minute') as slot_end,
      ((p_date + pw.window_end) at time zone v_business_timezone) as window_end_ts
    from professional_windows pw
    cross join lateral generate_series(
      0,
      greatest(0, (extract(epoch from (pw.window_end - pw.window_start))::int / 60) / v_slot_step_minutes)
    ) as n
  )
  select cs.professional_id, cs.professional_name, cs.slot_start, cs.slot_end
  from candidate_slots cs
  where cs.slot_end <= cs.window_end_ts
    and not exists (
      select 1 from public.professional_schedule_break b
      where b.schedule_id = cs.schedule_id
        and tstzrange(cs.slot_start, cs.slot_end)
          && tstzrange(
            (p_date + b.start_time) at time zone v_business_timezone,
            (p_date + b.end_time) at time zone v_business_timezone
          )
    )
    and not exists (
      select 1 from public.professional_block pb
      where pb.professional_id = cs.professional_id
        and pb.status = 'active'
        and tstzrange(cs.slot_start, cs.slot_end) && tstzrange(pb.starts_at, pb.ends_at)
    )
    and not exists (
      select 1 from public.professional_absence pa
      where pa.professional_id = cs.professional_id
        and tstzrange(cs.slot_start, cs.slot_end) && tstzrange(pa.starts_at, pa.ends_at)
    )
    and not exists (
      select 1 from public.appointment_service aps
      where aps.professional_id = cs.professional_id
        and aps.is_active
        and tstzrange(cs.slot_start, cs.slot_end) && tstzrange(aps.starts_at, aps.ends_at)
    )
  order by cs.professional_id, cs.slot_start;
end;
$$;

comment on function public.get_available_slots is
  'Fase 2 — motor de disponibilidade. SECURITY INVOKER: nunca contorna RLS, '
  'nunca vaza dado cross-tenant mesmo com ids forjados. Único lugar do '
  'sistema que decide a granularidade de slots (15 min).';
