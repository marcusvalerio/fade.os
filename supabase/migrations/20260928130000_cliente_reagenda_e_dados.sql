-- Área do cliente: reagendar pela própria conta, editar os próprios dados, e
-- uma correção de regra no link público.
--
-- 1. cancel_public_appointment: cancelava qualquer status que não fosse
--    concluído/cancelado/falta — ou seja, também "aguardando" (o cliente já
--    chegou) e "em atendimento". Agora só Agendado ou Confirmado, a mesma
--    regra que a tela sempre mostrou.
-- 2. get_my_reschedule_starts / reschedule_my_appointment: o cliente move o
--    próprio horário (Agendado ou Confirmado, no futuro), com as mesmas
--    regras de validade da barbearia (appointment_slot_problem). Volta a
--    "Agendado" para a barbearia reconfirmar, e fica na auditoria.
-- 3. get_my_client_profile / update_my_client_profile: nome, telefone e
--    consentimento de contato do próprio cadastro. O e-mail é o da conta.
--
-- Todas SECURITY DEFINER: a identidade (client_identity de auth.uid() na
-- barbearia do slug) é conferida aqui dentro — o cliente nunca lê tabela
-- operacional nem mexe em agendamento de outra pessoa.

create or replace function public.cancel_public_appointment(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_updated int;
begin
  update public.appointment
     set status = 'cancelled_by_client'
   where client_access_token = p_token
     and status in ('scheduled', 'confirmed');

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$function$;

create or replace function public.minha_identidade_na_barbearia(p_slug text)
returns table(company_id uuid, client_id uuid)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select ci.company_id, ci.client_id
    from public.client_identity ci
    join public.company c on c.id = ci.company_id
   where ci.user_id = auth.uid()
     and c.slug = p_slug
     and c.status = 'active'
   limit 1;
$function$;

create or replace function public.get_my_reschedule_starts(p_slug text, p_appointment_id uuid, p_date date)
returns table(slot_start timestamptz, slot_end timestamptz)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_eu record;
begin
  if auth.uid() is null then raise exception 'NAO_AUTENTICADO' using errcode = '28000'; end if;
  select * into v_eu from public.minha_identidade_na_barbearia(p_slug);
  if not found then raise exception 'CLIENTE_NAO_VINCULADO' using errcode = '42501'; end if;

  if not exists (
    select 1 from public.appointment a
     where a.id = p_appointment_id and a.company_id = v_eu.company_id and a.client_id = v_eu.client_id
       and a.status in ('scheduled', 'confirmed')
  ) then
    raise exception 'AGENDAMENTO_NAO_REAGENDAVEL' using errcode = '22023';
  end if;

  return query select g.slot_start, g.slot_end from public.get_reschedule_starts(p_appointment_id, p_date) g;
end;
$function$;

create or replace function public.reschedule_my_appointment(p_slug text, p_appointment_id uuid, p_starts_at timestamptz)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_eu record;
  v_appt public.appointment%rowtype;
  v_first timestamptz;
  v_before jsonb;
  v_line record;
  v_offset interval;
  v_problema text;
begin
  if auth.uid() is null then raise exception 'NAO_AUTENTICADO' using errcode = '28000'; end if;
  select * into v_eu from public.minha_identidade_na_barbearia(p_slug);
  if not found then raise exception 'CLIENTE_NAO_VINCULADO' using errcode = '42501'; end if;

  select * into v_appt from public.appointment
   where id = p_appointment_id and company_id = v_eu.company_id and client_id = v_eu.client_id
   for update;
  if not found or v_appt.status not in ('scheduled', 'confirmed') then
    raise exception 'AGENDAMENTO_NAO_REAGENDAVEL' using errcode = '22023';
  end if;
  if p_starts_at <= now() then raise exception 'HORARIO_NO_PASSADO' using errcode = '22023'; end if;

  select min(starts_at),
         jsonb_agg(jsonb_build_object('id', id, 'starts_at', starts_at, 'professional_id', professional_id) order by starts_at)
    into v_first, v_before
    from public.appointment_service where appointment_id = p_appointment_id;
  v_offset := p_starts_at - v_first;

  -- Valida todas as linhas antes de escrever (mesmas regras da barbearia).
  for v_line in select * from public.appointment_service where appointment_id = p_appointment_id order by starts_at loop
    v_problema := public.appointment_slot_problem(
      v_appt.company_id, v_appt.unit_id, v_line.service_id, v_line.professional_id,
      v_line.starts_at + v_offset, v_line.ends_at + v_offset, p_appointment_id
    );
    if v_problema is not null then
      raise exception 'HORARIO_INDISPONIVEL' using errcode = '23P01';
    end if;
  end loop;

  update public.appointment_service set is_active = false where appointment_id = p_appointment_id;
  for v_line in select * from public.appointment_service where appointment_id = p_appointment_id order by starts_at loop
    begin
      update public.appointment_service
         set starts_at = v_line.starts_at + v_offset, ends_at = v_line.ends_at + v_offset, is_active = true
       where id = v_line.id;
    exception when exclusion_violation then
      raise exception 'HORARIO_INDISPONIVEL' using errcode = '23P01';
    end;
  end loop;

  -- A barbearia precisa ver que o horário mudou: volta para Agendado.
  update public.appointment set status = 'scheduled', updated_at = now() where id = p_appointment_id;

  insert into public.audit_log (company_id, user_id, action, entity_type, entity_id, before, after, reason)
  values (v_appt.company_id, auth.uid(), 'client_reschedule_appointment', 'appointment', p_appointment_id,
          jsonb_build_object('lines', v_before, 'status', v_appt.status),
          jsonb_build_object('starts_at', p_starts_at, 'status', 'scheduled'),
          'Reagendado pelo cliente na área dele');
end;
$function$;

create or replace function public.get_my_client_profile(p_slug text)
returns table(name text, phone text, email text, communication_consent boolean)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_eu record;
begin
  if auth.uid() is null then raise exception 'NAO_AUTENTICADO' using errcode = '28000'; end if;
  select * into v_eu from public.minha_identidade_na_barbearia(p_slug);
  if not found then raise exception 'CLIENTE_NAO_VINCULADO' using errcode = '42501'; end if;
  return query select c.name, c.phone, c.email, coalesce(c.communication_consent, false) from public.client c where c.id = v_eu.client_id;
end;
$function$;

create or replace function public.update_my_client_profile(p_slug text, p_name text, p_phone text, p_consent boolean)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_eu record;
  v_nome text := btrim(coalesce(p_name, ''));
  v_fone text := nullif(btrim(coalesce(p_phone, '')), '');
begin
  if auth.uid() is null then raise exception 'NAO_AUTENTICADO' using errcode = '28000'; end if;
  select * into v_eu from public.minha_identidade_na_barbearia(p_slug);
  if not found then raise exception 'CLIENTE_NAO_VINCULADO' using errcode = '42501'; end if;
  if length(v_nome) < 2 or length(v_nome) > 120 then raise exception 'NOME_INVALIDO' using errcode = '22023'; end if;
  if v_fone is not null and length(regexp_replace(v_fone, '\D', '', 'g')) not between 10 and 13 then
    raise exception 'TELEFONE_INVALIDO' using errcode = '22023';
  end if;

  update public.client
     set name = v_nome, phone = v_fone, communication_consent = coalesce(p_consent, false), updated_at = now()
   where id = v_eu.client_id;
end;
$function$;

revoke all on function public.minha_identidade_na_barbearia(text) from public, anon, authenticated;
revoke all on function public.get_my_reschedule_starts(text, uuid, date) from public, anon;
revoke all on function public.reschedule_my_appointment(text, uuid, timestamptz) from public, anon;
revoke all on function public.get_my_client_profile(text) from public, anon;
revoke all on function public.update_my_client_profile(text, text, text, boolean) from public, anon;
grant execute on function public.get_my_reschedule_starts(text, uuid, date) to authenticated;
grant execute on function public.reschedule_my_appointment(text, uuid, timestamptz) to authenticated;
grant execute on function public.get_my_client_profile(text) to authenticated;
grant execute on function public.update_my_client_profile(text, text, text, boolean) to authenticated;
