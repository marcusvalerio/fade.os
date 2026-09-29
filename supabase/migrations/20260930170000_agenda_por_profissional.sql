-- Agenda: o profissional vê só o que é dele.
--
-- Antes: appointment e appointment_service liberavam SELECT/UPDATE/DELETE a
-- qualquer vínculo com a empresa (my_company_ids). Um barbeiro (papel staff)
-- lia a agenda da equipe inteira — pela tela, pela URL (?prof=) e direto na
-- API do Supabase com a própria sessão.
--
-- Agora a unidade de visibilidade é o AGENDAMENTO:
--   * dono/gerência (has_company_management_access): a empresa inteira, como
--     antes;
--   * demais vínculos: só agendamentos com ao menos uma linha de um
--     professional ligado à própria sessão (professional.user_id =
--     auth.uid()). As linhas desse agendamento aparecem juntas (é o mesmo
--     cliente, na mesma visita); a agenda do app ainda recorta pelo
--     professional_id da sessão.
--   * um agendamento ainda sem linhas é visível para quem é da empresa: é o
--     instante entre o INSERT ... RETURNING e as linhas em
--     create_internal_appointment (roda como quem chama).
--
-- INSERT não muda: quem é da equipe continua podendo marcar para um colega
-- (o banco valida o horário). Disponibilidade e conflito passam a ler a
-- ocupação por uma função que devolve só "ocupado/livre" — sem cliente, sem
-- serviço — para o horário de um colega continuar correto sem abrir a agenda
-- dele. reschedule_appointment confere a visibilidade explicitamente (e pode
-- entregar o horário a um colega, como antes).
--
-- Cliente (funções da área do cliente, SECURITY DEFINER), página pública e
-- Admin da plataforma (funções admin_*) não passam por estas políticas.

-- ---------------------------------------------------------------------------
-- 1. Quem pode ver
-- ---------------------------------------------------------------------------
-- Recebe a empresa já da linha (não consulta appointment): assim funciona
-- também no RETURNING de um INSERT, quando a própria linha ainda não é
-- visível para uma subconsulta.
create or replace function public.agenda_pode_ver(p_appointment uuid, p_company uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select p_company in (select public.my_company_ids())
     and (
       public.has_company_management_access(p_company)
       or exists (
         select 1 from public.appointment_service s
           join public.professional p on p.id = s.professional_id
          where s.appointment_id = p_appointment
            and p.company_id = p_company
            and p.user_id = auth.uid())
       or not exists (select 1 from public.appointment_service s where s.appointment_id = p_appointment)
     );
$function$;

create or replace function public.agenda_pode_ver_linha(p_appointment uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce((select public.agenda_pode_ver(a.id, a.company_id) from public.appointment a where a.id = p_appointment), false);
$function$;

-- Ocupação de um profissional num intervalo: só verdadeiro/falso. É o que a
-- disponibilidade precisa (e o que a página pública de agendamento já
-- revela ao mostrar horários livres).
create or replace function public.agenda_horario_ocupado(
  p_professional uuid, p_inicio timestamptz, p_fim timestamptz, p_excluir_appointment uuid default null
)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from public.appointment_service aps
     where aps.professional_id = p_professional
       and aps.is_active
       and aps.appointment_id is distinct from p_excluir_appointment
       and tstzrange(aps.starts_at, aps.ends_at) && tstzrange(p_inicio, p_fim));
$function$;

revoke all on function public.agenda_pode_ver(uuid, uuid) from public, anon;
revoke all on function public.agenda_pode_ver_linha(uuid) from public, anon;
revoke all on function public.agenda_horario_ocupado(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.agenda_pode_ver(uuid, uuid) to authenticated;
grant execute on function public.agenda_pode_ver_linha(uuid) to authenticated;
grant execute on function public.agenda_horario_ocupado(uuid, timestamptz, timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Políticas (INSERT inalterado)
-- ---------------------------------------------------------------------------
drop policy appointment_select on public.appointment;
create policy appointment_select on public.appointment for select to authenticated
  using (company_id in (select public.my_company_ids()) and public.agenda_pode_ver(id, company_id));

drop policy appointment_update on public.appointment;
create policy appointment_update on public.appointment for update to authenticated
  using (company_id in (select public.my_company_ids()) and public.agenda_pode_ver(id, company_id))
  with check (company_id in (select public.my_company_ids()));

drop policy appointment_delete on public.appointment;
create policy appointment_delete on public.appointment for delete to authenticated
  using (company_id in (select public.my_company_ids()) and public.agenda_pode_ver(id, company_id));

drop policy appointment_service_select on public.appointment_service;
create policy appointment_service_select on public.appointment_service for select to authenticated
  using (public.agenda_pode_ver_linha(appointment_id));

drop policy appointment_service_update on public.appointment_service;
create policy appointment_service_update on public.appointment_service for update to authenticated
  using (public.agenda_pode_ver_linha(appointment_id))
  with check (exists (select 1 from public.appointment a
                       where a.id = appointment_service.appointment_id
                         and a.company_id in (select public.my_company_ids())));

-- ---------------------------------------------------------------------------
-- 3. Disponibilidade e conflito: ocupação pela função (corpo igual ao
--    anterior; só o trecho de appointment_service mudou)
-- ---------------------------------------------------------------------------
create or replace function public.appointment_slot_problem(p_company_id uuid, p_unit_id uuid, p_service_id uuid, p_professional_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_exclude_appointment_id uuid default null::uuid)
 returns text
 language plpgsql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_business_timezone constant text := 'America/Sao_Paulo';
  v_local_start timestamp; v_local_end timestamp; v_date date; v_weekday int;
  v_start_time time; v_end_time time;
begin
  if p_ends_at <= p_starts_at then return 'HORARIO_INVALIDO'; end if;

  if not exists (select 1 from public.professional p
    where p.id = p_professional_id and p.company_id = p_company_id and p.active
      and (p.unit_id is null or p.unit_id = p_unit_id)) then
    return 'PROFISSIONAL_INVALIDO'; end if;

  if not exists (select 1 from public.service s
    where s.id = p_service_id and s.company_id = p_company_id and s.status = 'active') then
    return 'SERVICO_INVALIDO'; end if;

  if not exists (select 1 from public.professional_service ps
    where ps.professional_id = p_professional_id and ps.service_id = p_service_id) then
    return 'PROFISSIONAL_NAO_HABILITADO'; end if;

  v_local_start := p_starts_at at time zone v_business_timezone;
  v_local_end := p_ends_at at time zone v_business_timezone;
  v_date := v_local_start::date;
  v_weekday := extract(dow from v_date)::int;
  v_start_time := v_local_start::time;
  v_end_time := v_local_end::time;

  if v_local_end::date <> v_date then return 'FORA_DA_JORNADA'; end if;

  if not exists (select 1 from public.unit_business_hours ubh
    where ubh.unit_id = p_unit_id and ubh.weekday = v_weekday and ubh.active
      and ubh.start_time <= v_start_time and ubh.end_time >= v_end_time) then
    return 'FORA_DO_FUNCIONAMENTO'; end if;

  if not exists (select 1 from public.professional_schedule psch
    where psch.professional_id = p_professional_id and psch.weekday = v_weekday and psch.active
      and psch.start_time <= v_start_time and psch.end_time >= v_end_time
      and not exists (select 1 from public.professional_schedule_break b
        where b.schedule_id = psch.id and b.start_time < v_end_time and b.end_time > v_start_time)) then
    return 'FORA_DA_JORNADA'; end if;

  if exists (select 1 from public.professional_block pb
    where pb.professional_id = p_professional_id and pb.status = 'active'
      and tstzrange(pb.starts_at, pb.ends_at) && tstzrange(p_starts_at, p_ends_at)) then
    return 'PROFISSIONAL_BLOQUEADO'; end if;

  if exists (select 1 from public.professional_absence pa
    where pa.professional_id = p_professional_id
      and tstzrange(pa.starts_at, pa.ends_at) && tstzrange(p_starts_at, p_ends_at)) then
    return 'PROFISSIONAL_AUSENTE'; end if;

  if public.agenda_horario_ocupado(p_professional_id, p_starts_at, p_ends_at, p_exclude_appointment_id) then
    return 'HORARIO_INDISPONIVEL'; end if;

  return null;
end;
$function$;

create or replace function public.get_available_slots(p_company_id uuid, p_unit_id uuid, p_service_id uuid, p_date date, p_professional_id uuid default null::uuid, p_service_ids uuid[] default null::uuid[])
 returns table(professional_id uuid, professional_name text, slot_start timestamp with time zone, slot_end timestamp with time zone)
 language plpgsql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_duration_minutes int;
  v_slot_step_minutes constant int := 15;
  v_business_timezone constant text := 'America/Sao_Paulo';
  v_weekday int;
  v_unit_has_hours boolean;
  v_matched_services int;
begin
  if p_service_ids is not null and array_length(p_service_ids, 1) > 0 then
    select count(*), coalesce(sum(planned_duration_minutes), 0)
      into v_matched_services, v_duration_minutes
      from public.service_operational
      where id = any(p_service_ids) and company_id = p_company_id;

    if v_matched_services is distinct from array_length(p_service_ids, 1) then
      v_duration_minutes := null;
    end if;
  else
    select planned_duration_minutes into v_duration_minutes
    from public.service_operational
    where id = p_service_id and company_id = p_company_id;
  end if;

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
    where p.company_id = p_company_id
      and p.active
      and (p_professional_id is null or p.id = p_professional_id)
      and (p.unit_id is null or p.unit_id = p_unit_id)
      and (
        case
          when p_service_ids is not null and array_length(p_service_ids, 1) > 0 then
            (select count(distinct ps.service_id) from public.professional_service ps
              where ps.professional_id = p.id and ps.service_id = any(p_service_ids))
            = array_length(p_service_ids, 1)
          else
            exists (
              select 1 from public.professional_service ps
              where ps.professional_id = p.id and ps.service_id = p_service_id
            )
        end
      )
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
    and cs.slot_start > now()
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
    and not public.agenda_horario_ocupado(cs.professional_id, cs.slot_start, cs.slot_end, null)
  order by cs.professional_id, cs.slot_start;
end;
$function$;

create or replace function public.get_available_slots_excluding(p_exclude_appointment_id uuid, p_company_id uuid, p_unit_id uuid, p_service_id uuid, p_date date, p_professional_id uuid default null::uuid, p_service_ids uuid[] default null::uuid[])
 returns table(professional_id uuid, professional_name text, slot_start timestamp with time zone, slot_end timestamp with time zone)
 language plpgsql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_duration_minutes int;
  v_slot_step_minutes constant int := 15;
  v_business_timezone constant text := 'America/Sao_Paulo';
  v_weekday int;
  v_unit_has_hours boolean;
  v_matched_services int;
begin
  if p_service_ids is not null and array_length(p_service_ids, 1) > 0 then
    select count(*), coalesce(sum(planned_duration_minutes), 0)
      into v_matched_services, v_duration_minutes
      from public.service_operational
      where id = any(p_service_ids) and company_id = p_company_id;

    if v_matched_services is distinct from array_length(p_service_ids, 1) then
      v_duration_minutes := null;
    end if;
  else
    select planned_duration_minutes into v_duration_minutes
    from public.service_operational
    where id = p_service_id and company_id = p_company_id;
  end if;

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
    where p.company_id = p_company_id
      and p.active
      and (p_professional_id is null or p.id = p_professional_id)
      and (p.unit_id is null or p.unit_id = p_unit_id)
      and (
        case
          when p_service_ids is not null and array_length(p_service_ids, 1) > 0 then
            (select count(distinct ps.service_id) from public.professional_service ps
              where ps.professional_id = p.id and ps.service_id = any(p_service_ids))
            = array_length(p_service_ids, 1)
          else
            exists (
              select 1 from public.professional_service ps
              where ps.professional_id = p.id and ps.service_id = p_service_id
            )
        end
      )
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
    and cs.slot_start > now()
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
    and not public.agenda_horario_ocupado(cs.professional_id, cs.slot_start, cs.slot_end, p_exclude_appointment_id)
  order by cs.professional_id, cs.slot_start;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Reagendar: confere quem pode (antes dependia só da RLS da empresa).
--    SECURITY DEFINER para poder entregar o horário a um colega — depois da
--    troca o agendamento deixa de ser visível para quem reagendou, e a RLS
--    recusaria a última escrita. Corpo igual ao anterior, fora a checagem.
-- ---------------------------------------------------------------------------
create or replace function public.reschedule_appointment(p_appointment_id uuid, p_starts_at timestamp with time zone, p_professional_id uuid default null::uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_appt public.appointment%rowtype;
  v_first timestamptz;
  v_offset interval;
  v_line record;
  v_before jsonb;
  v_new_start timestamptz;
  v_new_end timestamptz;
  v_prof uuid;
begin
  select * into v_appt from public.appointment where id = p_appointment_id for update;
  -- mesma resposta para "não existe" e "não é seu": não revela nada
  if not found or not public.agenda_pode_ver(v_appt.id, v_appt.company_id) then
    raise exception 'AGENDAMENTO_NAO_ENCONTRADO' using errcode = 'P0002';
  end if;

  if v_appt.status not in ('scheduled', 'confirmed') then
    raise exception 'AGENDAMENTO_NAO_REAGENDAVEL' using errcode = '22023';
  end if;

  if p_starts_at <= now() then
    raise exception 'HORARIO_NO_PASSADO' using errcode = '22023';
  end if;

  select min(starts_at),
         jsonb_agg(jsonb_build_object('id', id, 'starts_at', starts_at, 'professional_id', professional_id) order by starts_at)
    into v_first, v_before
    from public.appointment_service
   where appointment_id = p_appointment_id;

  if v_first is null then
    raise exception 'AGENDAMENTO_SEM_SERVICOS' using errcode = '22023';
  end if;

  v_offset := p_starts_at - v_first;

  update public.appointment_service set is_active = false where appointment_id = p_appointment_id;

  for v_line in
    select id, service_id, professional_id, starts_at, ends_at
      from public.appointment_service
     where appointment_id = p_appointment_id
     order by starts_at
  loop
    v_new_start := v_line.starts_at + v_offset;
    v_new_end := v_line.ends_at + v_offset;
    v_prof := coalesce(p_professional_id, v_line.professional_id);

    perform public.assert_appointment_slot_valid(
      v_appt.company_id, v_appt.unit_id, v_line.service_id, v_prof, v_new_start, v_new_end
    );

    begin
      update public.appointment_service
         set starts_at = v_new_start, ends_at = v_new_end, professional_id = v_prof, is_active = true
       where id = v_line.id;
    exception when exclusion_violation then
      raise exception 'HORARIO_INDISPONIVEL' using errcode = '23P01';
    end;
  end loop;

  update public.appointment set updated_at = now() where id = p_appointment_id;

  perform public.write_audit_log(
    v_appt.company_id, 'reschedule_appointment', 'appointment', p_appointment_id,
    jsonb_build_object('lines', v_before),
    jsonb_build_object('starts_at', p_starts_at, 'professional_id', p_professional_id),
    null
  );
end;
$function$;
