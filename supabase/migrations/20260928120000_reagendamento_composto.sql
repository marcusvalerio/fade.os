-- Reagendamento de agendamento com serviços de profissionais diferentes.
--
-- O motor de horários gera inícios numa grade (passo fixo a partir da
-- janela). Quando o segundo serviço começa, por exemplo, 40 minutos depois
-- do primeiro, o início dele cai fora da grade: cruzar as listas de
-- horários de cada serviço nunca encontraria nada. A pergunta certa é "para
-- este início do agendamento, TODAS as linhas cabem?" — e quem responde é o
-- banco, com as mesmas regras de sempre.
--
-- 1. appointment_slot_problem(...): as regras de validade de um horário,
--    num lugar só, devolvendo o motivo (ou null). Aceita ignorar as linhas
--    de um agendamento (o que está sendo reagendado).
-- 2. assert_appointment_slot_valid: passa a ser só "se houver problema,
--    levanta" — mesmos códigos e mesmos errcodes de antes.
-- 3. get_reschedule_starts(appointment, dia): inícios candidatos da grade
--    do primeiro serviço em que todas as linhas, deslocadas, são válidas.

create or replace function public.appointment_slot_problem(
  p_company_id uuid, p_unit_id uuid, p_service_id uuid, p_professional_id uuid,
  p_starts_at timestamptz, p_ends_at timestamptz, p_exclude_appointment_id uuid default null
)
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

  if exists (select 1 from public.appointment_service aps
    where aps.professional_id = p_professional_id and aps.is_active
      and aps.appointment_id is distinct from p_exclude_appointment_id
      and tstzrange(aps.starts_at, aps.ends_at) && tstzrange(p_starts_at, p_ends_at)) then
    return 'HORARIO_INDISPONIVEL'; end if;

  return null;
end;
$function$;

create or replace function public.assert_appointment_slot_valid(
  p_company_id uuid, p_unit_id uuid, p_service_id uuid, p_professional_id uuid,
  p_starts_at timestamptz, p_ends_at timestamptz
)
returns void
language plpgsql
stable
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_problema text;
begin
  v_problema := public.appointment_slot_problem(
    p_company_id, p_unit_id, p_service_id, p_professional_id, p_starts_at, p_ends_at, null
  );
  if v_problema is null then return; end if;
  if v_problema = 'HORARIO_INDISPONIVEL' then
    raise exception 'HORARIO_INDISPONIVEL' using errcode = '23P01';
  end if;
  raise exception '%', v_problema using errcode = '22023';
end;
$function$;

create or replace function public.get_reschedule_starts(p_appointment_id uuid, p_date date)
returns table(slot_start timestamptz, slot_end timestamptz)
language plpgsql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_appt public.appointment%rowtype;
  v_primeira record;
  v_candidato record;
  v_linha record;
  v_desloc interval;
  v_ok boolean;
  v_fim timestamptz;
begin
  -- RLS: só enxerga o agendamento quem é da mesma empresa.
  select * into v_appt from public.appointment where id = p_appointment_id;
  if not found then return; end if;

  select * into v_primeira
    from public.appointment_service
   where appointment_id = p_appointment_id
   order by starts_at
   limit 1;
  if not found then return; end if;

  for v_candidato in
    select s.slot_start
      from public.get_available_slots_excluding(
        p_appointment_id, v_appt.company_id, v_appt.unit_id, v_primeira.service_id,
        p_date, v_primeira.professional_id, array[v_primeira.service_id]
      ) s
     where s.professional_id = v_primeira.professional_id
     order by s.slot_start
  loop
    v_ok := true;
    v_fim := v_candidato.slot_start;
    for v_linha in
      select * from public.appointment_service
       where appointment_id = p_appointment_id
       order by starts_at
    loop
      v_desloc := v_linha.starts_at - v_primeira.starts_at;
      if public.appointment_slot_problem(
        v_appt.company_id, v_appt.unit_id, v_linha.service_id, v_linha.professional_id,
        v_candidato.slot_start + v_desloc,
        v_candidato.slot_start + v_desloc + (v_linha.ends_at - v_linha.starts_at),
        p_appointment_id
      ) is not null then
        v_ok := false;
        exit;
      end if;
      v_fim := greatest(v_fim, v_candidato.slot_start + v_desloc + (v_linha.ends_at - v_linha.starts_at));
    end loop;
    if v_ok then
      slot_start := v_candidato.slot_start;
      slot_end := v_fim;
      return next;
    end if;
  end loop;
end;
$function$;

revoke all on function public.appointment_slot_problem(uuid, uuid, uuid, uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.appointment_slot_problem(uuid, uuid, uuid, uuid, timestamptz, timestamptz, uuid) to authenticated;
revoke all on function public.get_reschedule_starts(uuid, date) from public, anon;
grant execute on function public.get_reschedule_starts(uuid, date) to authenticated;
