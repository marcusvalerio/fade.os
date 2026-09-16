-- Operational hardening: agenda <-> attendance
--
-- Objetivos desta migration:
-- 1. Impedir transições arbitrárias de appointment.status.
-- 2. Impedir que um atendimento concluído seja cancelado depois.
-- 3. Manter appointment.status sincronizado quando um attendance é cancelado.
-- 4. Tornar o início de atendimento idempotente e atômico.
--
-- Não apagamos histórico nem dependemos de uma UNIQUE em
-- attendance.origin_appointment_id porque uma UNIQUE nova poderia falhar em
-- dados históricos já existentes. A proteção de concorrência usa advisory lock
-- transacional por appointment.

create or replace function public.validate_appointment_status_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'scheduled' and new.status in ('confirmed', 'arrived', 'in_progress', 'cancelled_by_client', 'cancelled_by_company', 'no_show'))
    or
    (old.status = 'confirmed' and new.status in ('arrived', 'in_progress', 'cancelled_by_client', 'cancelled_by_company', 'no_show'))
    or
    (old.status = 'arrived' and new.status in ('in_progress', 'cancelled_by_company', 'no_show'))
    or
    (old.status = 'in_progress' and new.status in ('completed', 'cancelled_by_company'))
  ) then
    raise exception 'TRANSICAO_AGENDAMENTO_INVALIDA' using errcode = '22023';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_appointment_status_transition on public.appointment;
create trigger trg_appointment_status_transition
before update of status on public.appointment
for each row
execute function public.validate_appointment_status_transition();

create or replace function public.validate_attendance_status_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status = 'in_progress' and new.status in ('completed', 'cancelled') then
    return new;
  end if;

  raise exception 'TRANSICAO_ATENDIMENTO_INVALIDA' using errcode = '22023';
end;
$function$;

drop trigger if exists trg_attendance_status_transition on public.attendance;
create trigger trg_attendance_status_transition
before update of status on public.attendance
for each row
execute function public.validate_attendance_status_transition();

create or replace function public.sync_cancelled_attendance_to_appointment()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' and new.origin_appointment_id is not null then
    update public.appointment
       set status = 'cancelled_by_company', updated_at = now()
     where id = new.origin_appointment_id
       and status in ('scheduled', 'confirmed', 'arrived', 'in_progress');
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_sync_cancelled_attendance_to_appointment on public.attendance;
create trigger trg_sync_cancelled_attendance_to_appointment
after update of status on public.attendance
for each row
execute function public.sync_cancelled_attendance_to_appointment();

-- O início de atendimento passa a ser uma única transação no banco.
-- O advisory lock elimina a corrida entre dois cliques/retries simultâneos
-- para o mesmo agendamento. Se o atendimento já existir, devolvemos o mesmo
-- ID em vez de criar outro.
create or replace function public.start_attendance_from_appointment(p_appointment_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_appointment public.appointment;
  v_attendance_id uuid;
  v_line record;
  v_company_id uuid;
begin
  if p_appointment_id is null then
    raise exception 'AGENDAMENTO_NAO_ENCONTRADO' using errcode = 'P0002';
  end if;

  -- Mesmo appointment => mesma seção crítica, inclusive em dois requests
  -- concorrentes vindos de double-click/retry/reconnect.
  perform pg_advisory_xact_lock(hashtextextended(p_appointment_id::text, 0));

  select * into v_appointment
    from public.appointment
   where id = p_appointment_id
   for update;

  if v_appointment.id is null then
    raise exception 'AGENDAMENTO_NAO_ENCONTRADO' using errcode = 'P0002';
  end if;

  v_company_id := v_appointment.company_id;

  if not exists (
    select 1
      from public.user_company_role ucr
     where ucr.user_id = auth.uid()
       and ucr.company_id = v_company_id
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- Idempotência: um retry de uma operação já concluída retorna o atendimento
  -- existente, sem duplicar venda/itens posteriormente.
  select id into v_attendance_id
    from public.attendance
   where origin_appointment_id = p_appointment_id
   order by created_at
   limit 1;

  if v_attendance_id is not null then
    if v_appointment.status = 'completed' then
      raise exception 'AGENDAMENTO_JA_CONCLUIDO' using errcode = '22023';
    end if;

    if exists (
      select 1 from public.attendance
       where id = v_attendance_id and status = 'cancelled'
    ) then
      raise exception 'ATENDIMENTO_CANCELADO' using errcode = '22023';
    end if;

    if v_appointment.status <> 'in_progress' then
      update public.appointment
         set status = 'in_progress', updated_at = now()
       where id = p_appointment_id;
    end if;

    return v_attendance_id;
  end if;

  if v_appointment.status in ('completed', 'cancelled_by_client', 'cancelled_by_company', 'no_show') then
    raise exception 'AGENDAMENTO_NAO_PODE_INICIAR' using errcode = '22023';
  end if;

  insert into public.attendance (
    company_id,
    unit_id,
    client_id,
    origin_appointment_id,
    origin,
    status
  )
  values (
    v_appointment.company_id,
    v_appointment.unit_id,
    v_appointment.client_id,
    v_appointment.id,
    'from_appointment',
    'in_progress'
  )
  returning id into v_attendance_id;

  -- As RPCs existentes continuam sendo a autoridade para preço, profissional,
  -- unidade, serviço ativo, desconto/cortesia e autorização. Como esta função
  -- é uma única transação, se qualquer linha falhar, o attendance recém-criado
  -- também é revertido.
  for v_line in
    select service_id, professional_id
      from public.appointment_service
     where appointment_id = p_appointment_id
       and is_active = true
     order by starts_at, id
  loop
    perform public.add_attendance_service_item(
      p_attendance_id => v_attendance_id,
      p_service_id => v_line.service_id,
      p_professional_id => v_line.professional_id,
      p_discount => 0,
      p_type => 'normal',
      p_courtesy_reason => null,
      p_authorization_code => null
    );
  end loop;

  if not exists (
    select 1 from public.attendance_item where attendance_id = v_attendance_id
  ) then
    raise exception 'AGENDAMENTO_SEM_SERVICOS_ATIVOS' using errcode = '22023';
  end if;

  update public.appointment
     set status = 'in_progress', updated_at = now()
   where id = p_appointment_id;

  return v_attendance_id;
end;
$function$;

grant execute on function public.start_attendance_from_appointment(uuid) to authenticated;
