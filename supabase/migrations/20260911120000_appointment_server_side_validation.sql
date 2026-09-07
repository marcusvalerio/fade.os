-- FADE OS — FASE 6: disponibilidade validada no servidor.
--
-- Problema (docs/auditoria-pre-piloto.md, P1.2): o agendamento público passa
-- por create_public_appointment, que confere tudo. O agendamento INTERNO não:
-- actions/agenda.ts só verificava que unidade, cliente, serviço e profissional
-- pertenciam à empresa. O formulário tem dois campos datetime-local livres —
-- ou seja, o horário e até a DURAÇÃO eram decididos pelo navegador.
--
-- A única barreira real era a exclusion constraint appointment_service_no_overlap,
-- que cobre apenas sobreposição do mesmo profissional. Dava para agendar de
-- madrugada, com a barbearia fechada, com o profissional de férias, com um
-- profissional de outra unidade, ou com um profissional que não faz o serviço.
--
-- Em vez de duplicar o motor, esta migration extrai as MESMAS regras que
-- get_available_slots aplica (jornada ∩ funcionamento, intervalos, bloqueios,
-- ausências) num validador que aceita um intervalo arbitrário em vez de uma
-- grade de 15 em 15 minutos. A grade continua governando o que a UI oferece;
-- ela não pode governar o que a barbearia é capaz de encaixar à mão.

-- ---------------------------------------------------------------------------
-- Validador de um intervalo
-- ---------------------------------------------------------------------------
create or replace function public.assert_appointment_slot_valid(
  p_company_id uuid,
  p_unit_id uuid,
  p_service_id uuid,
  p_professional_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns void
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_business_timezone constant text := 'America/Sao_Paulo';
  v_local_start timestamp;
  v_local_end timestamp;
  v_date date;
  v_weekday int;
  v_start_time time;
  v_end_time time;
begin
  if p_ends_at <= p_starts_at then
    raise exception 'HORARIO_INVALIDO' using errcode = '22023';
  end if;

  -- Profissional: da empresa, ativo e desta unidade. unit_id nulo significa
  -- "atende em qualquer unidade", que é como o motor já o trata.
  if not exists (
    select 1 from public.professional p
    where p.id = p_professional_id
      and p.company_id = p_company_id
      and p.active
      and (p.unit_id is null or p.unit_id = p_unit_id)
  ) then
    raise exception 'PROFISSIONAL_INVALIDO' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.service s
    where s.id = p_service_id and s.company_id = p_company_id and s.status = 'active'
  ) then
    raise exception 'SERVICO_INVALIDO' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.professional_service ps
    where ps.professional_id = p_professional_id and ps.service_id = p_service_id
  ) then
    raise exception 'PROFISSIONAL_NAO_HABILITADO' using errcode = '22023';
  end if;

  v_local_start := p_starts_at at time zone v_business_timezone;
  v_local_end := p_ends_at at time zone v_business_timezone;
  v_date := v_local_start::date;
  v_weekday := extract(dow from v_date)::int;
  v_start_time := v_local_start::time;
  v_end_time := v_local_end::time;

  -- Atravessar a meia-noite não é um encaixe válido: nenhuma jornada nem
  -- horário de funcionamento cobre dois dias.
  if v_local_end::date <> v_date then
    raise exception 'FORA_DA_JORNADA' using errcode = '22023';
  end if;

  -- Funcionamento da unidade.
  if not exists (
    select 1 from public.unit_business_hours ubh
    where ubh.unit_id = p_unit_id
      and ubh.weekday = v_weekday
      and ubh.active
      and ubh.start_time <= v_start_time
      and ubh.end_time >= v_end_time
  ) then
    raise exception 'FORA_DO_FUNCIONAMENTO' using errcode = '22023';
  end if;

  -- Jornada do profissional, e fora dos intervalos dessa jornada.
  if not exists (
    select 1 from public.professional_schedule psch
    where psch.professional_id = p_professional_id
      and psch.weekday = v_weekday
      and psch.active
      and psch.start_time <= v_start_time
      and psch.end_time >= v_end_time
      and not exists (
        select 1 from public.professional_schedule_break b
        where b.schedule_id = psch.id
          and b.start_time < v_end_time
          and b.end_time > v_start_time
      )
  ) then
    raise exception 'FORA_DA_JORNADA' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.professional_block pb
    where pb.professional_id = p_professional_id
      and pb.status = 'active'
      and tstzrange(pb.starts_at, pb.ends_at) && tstzrange(p_starts_at, p_ends_at)
  ) then
    raise exception 'PROFISSIONAL_BLOQUEADO' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.professional_absence pa
    where pa.professional_id = p_professional_id
      and tstzrange(pa.starts_at, pa.ends_at) && tstzrange(p_starts_at, p_ends_at)
  ) then
    raise exception 'PROFISSIONAL_AUSENTE' using errcode = '22023';
  end if;

  -- Conflito de agenda. A exclusion constraint appointment_service_no_overlap
  -- é quem garante isso de forma atômica no insert; esta verificação existe
  -- para responder com uma mensagem clara antes de chegar lá.
  if exists (
    select 1 from public.appointment_service aps
    where aps.professional_id = p_professional_id
      and aps.is_active
      and tstzrange(aps.starts_at, aps.ends_at) && tstzrange(p_starts_at, p_ends_at)
  ) then
    raise exception 'HORARIO_INDISPONIVEL' using errcode = '23P01';
  end if;
end;
$$;

revoke all on function public.assert_appointment_slot_valid(uuid, uuid, uuid, uuid, timestamptz, timestamptz) from public;
grant execute on function public.assert_appointment_slot_valid(uuid, uuid, uuid, uuid, timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Criação do agendamento interno
-- ---------------------------------------------------------------------------
-- Substitui o insert em duas etapas da Server Action, que criava o
-- appointment, tentava inserir os appointment_service e, na falha, apagava o
-- appointment como compensação. Numa função tudo é uma transação só: ou o
-- agendamento inteiro existe, ou nada existe.
--
-- A duração NÃO vem do payload: é sempre service.planned_duration_minutes. O
-- formulário tinha um campo de fim livre, o que permitia reservar 5 minutos
-- para um serviço de uma hora e liberar o resto da agenda do profissional.
create or replace function public.create_internal_appointment(
  p_company_id uuid,
  p_unit_id uuid,
  p_client_id uuid,
  p_lines jsonb
)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_appointment_id uuid;
  v_line jsonb;
  v_line_count int;
begin
  v_line_count := jsonb_array_length(coalesce(p_lines, '[]'::jsonb));
  if v_line_count = 0 then
    raise exception 'AGENDAMENTO_SEM_SERVICOS' using errcode = '22023';
  end if;

  if not exists (select 1 from public.unit u where u.id = p_unit_id and u.company_id = p_company_id) then
    raise exception 'UNIDADE_INVALIDA' using errcode = '22023';
  end if;

  if not exists (select 1 from public.client c where c.id = p_client_id and c.company_id = p_company_id) then
    raise exception 'CLIENTE_INVALIDO' using errcode = '22023';
  end if;

  insert into public.appointment (company_id, unit_id, client_id, status)
  values (p_company_id, p_unit_id, p_client_id, 'scheduled')
  returning id into v_appointment_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    declare
      v_service_id uuid := (v_line->>'service_id')::uuid;
      v_professional_id uuid := (v_line->>'professional_id')::uuid;
      v_starts_at timestamptz := (v_line->>'starts_at')::timestamptz;
      v_duration int;
      v_ends_at timestamptz;
    begin
      if v_starts_at is null then
        raise exception 'HORARIO_INVALIDO' using errcode = '22023';
      end if;

      select s.planned_duration_minutes into v_duration
        from public.service s
        where s.id = v_service_id and s.company_id = p_company_id and s.status = 'active';

      if v_duration is null then
        raise exception 'SERVICO_INVALIDO' using errcode = '22023';
      end if;

      v_ends_at := v_starts_at + make_interval(mins => v_duration);

      perform public.assert_appointment_slot_valid(
        p_company_id, p_unit_id, v_service_id, v_professional_id, v_starts_at, v_ends_at
      );

      -- A exclusion constraint é a garantia atômica: entre a verificação acima
      -- e este insert, outra sessão pode ter reservado o mesmo horário.
      begin
        insert into public.appointment_service (appointment_id, service_id, professional_id, starts_at, ends_at)
        values (v_appointment_id, v_service_id, v_professional_id, v_starts_at, v_ends_at);
      exception when exclusion_violation or unique_violation then
        raise exception 'HORARIO_INDISPONIVEL' using errcode = '23P01';
      end;
    end;
  end loop;

  return v_appointment_id;
end;
$$;

revoke all on function public.create_internal_appointment(uuid, uuid, uuid, jsonb) from public;
grant execute on function public.create_internal_appointment(uuid, uuid, uuid, jsonb) to authenticated;
