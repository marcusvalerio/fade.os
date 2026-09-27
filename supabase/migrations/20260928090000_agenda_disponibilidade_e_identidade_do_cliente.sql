-- ============================================================================
-- Agenda: disponibilidade coerente + reagendamento + identidade do cliente
-- ============================================================================
--
-- 1. FUSO NO AGENDAMENTO PÚBLICO (bug real). create_public_appointment e
--    create_public_appointment_multi conferiam o horário escolhido contra o
--    motor usando `p_starts_at::date`. O banco roda em UTC: das 21:00 (horário
--    de Brasília) em diante esse cast devolve o DIA SEGUINTE, o motor é
--    consultado na data errada e um horário que a própria tela mostrou como
--    livre é recusado como HORARIO_INDISPONIVEL. Provado com dados reais da
--    NORTE 21 (29/09, 21:00). Agora a data é a do relógio da barbearia.
--
-- 2. HORÁRIOS PASSADOS. get_available_slots oferecia, para hoje, horários que
--    já passaram. A vitrine filtrava no navegador; qualquer outro consumidor
--    (a agenda interna passa a usar o motor) receberia horários mortos. O
--    motor passa a devolver só horários que começam depois de agora. A
--    gravação interna (create_internal_appointment) continua sem essa trava:
--    registrar retroativamente um horário é uma operação legítima da equipe.
--
-- 3. REAGENDAMENTO. Não existia. reschedule_appointment move um agendamento
--    (todas as suas linhas, na mesma sequência e duração) para um novo início
--    e, opcionalmente, outro profissional — validando cada linha pela mesma
--    assert_appointment_slot_valid da criação, com a restrição de exclusão
--    `appointment_service_no_overlap` como última barreira contra corrida.
--    SECURITY INVOKER: a RLS de appointment/appointment_service decide quem
--    pode. Ou move tudo, ou nada.
--
-- 4. IDENTIDADE DO CLIENTE. O cliente final passa a poder ter conta (e-mail e
--    senha ou Google), separada da equipe:
--      auth.users ──< client_identity >── client ──< appointment
--    client_identity liga UM usuário a UM registro de cliente POR barbearia.
--    O vínculo só nasce por e-mail VERIFICADO (auth.users.email_confirmed_at),
--    nunca por telefone digitado — senão qualquer um reivindicaria o
--    histórico de outra pessoa digitando o número dela. O cliente não ganha
--    NENHUMA leitura direta das tabelas operacionais (my_company_ids() só
--    olha user_company_role): tudo passa por funções SECURITY DEFINER que
--    filtram pela identidade de auth.uid().
-- ============================================================================

-- 1. Fuso na conferência do agendamento público --------------------------------
do $$
declare
  v_def text;
  v_fn regprocedure;
begin
  foreach v_fn in array array[
    'public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,uuid)'::regprocedure,
    'public.create_public_appointment_multi(text,uuid[],uuid,timestamptz,text,text,text,uuid)'::regprocedure
  ] loop
    v_def := pg_get_functiondef(v_fn);
    continue when position('(p_starts_at at time zone ''America/Sao_Paulo'')::date' in v_def) > 0;
    if position('p_starts_at::date' in v_def) = 0 then
      raise exception 'Definição inesperada de %: trecho p_starts_at::date não encontrado', v_fn;
    end if;
    execute replace(v_def, 'p_starts_at::date', '(p_starts_at at time zone ''America/Sao_Paulo'')::date');
  end loop;
end $$;

-- 2. Motor sem horários passados -----------------------------------------------
do $$
declare
  v_def text := pg_get_functiondef('public.get_available_slots(uuid,uuid,uuid,date,uuid,uuid[])'::regprocedure);
  v_old constant text := 'where cs.slot_end <= cs.window_end_ts';
begin
  if position(v_old in v_def) = 0 then
    raise exception 'Definição inesperada de get_available_slots';
  end if;
  if position('cs.slot_start > now()' in v_def) = 0 then
    execute replace(v_def, v_old, v_old || E'\n    and cs.slot_start > now()');
  end if;
end $$;

-- 3. Reagendamento ---------------------------------------------------------------
create or replace function public.reschedule_appointment(
  p_appointment_id uuid,
  p_starts_at timestamptz,
  p_professional_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
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
  if not found then
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

  -- Tira as próprias linhas da conta de conflito antes de validar o novo
  -- horário (senão um reagendamento de 15 minutos colidiria consigo mesmo).
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
$$;

revoke all on function public.reschedule_appointment(uuid, timestamptz, uuid) from public, anon;
grant execute on function public.reschedule_appointment(uuid, timestamptz, uuid) to authenticated;

-- 4. Identidade do cliente -------------------------------------------------------
create table if not exists public.client_identity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.company(id) on delete cascade,
  client_id uuid not null references public.client(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint client_identity_user_company_key unique (user_id, company_id)
);

create index if not exists client_identity_client_idx on public.client_identity (client_id);

alter table public.client_identity enable row level security;

-- O próprio cliente vê o seu vínculo; a equipe da barbearia vê quais clientes
-- têm conta. Ninguém escreve direto: o vínculo só nasce por link_client_identity.
drop policy if exists client_identity_select_own on public.client_identity;
create policy client_identity_select_own on public.client_identity
  for select to authenticated
  using (user_id = auth.uid() or company_id in (select public.my_company_ids()));

revoke all on public.client_identity from anon;
grant select on public.client_identity to authenticated;

-- Vincula o usuário autenticado a um cliente da barbearia (por e-mail
-- verificado) e devolve o perfil. Idempotente.
create or replace function public.link_client_identity(
  p_slug text,
  p_name text default null,
  p_phone text default null
)
returns table (client_id uuid, client_name text, client_email text, client_phone text, company_id uuid, company_name text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_meta jsonb;
  v_company_id uuid;
  v_company_status text;
  v_client_id uuid;
  v_name text;
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO' using errcode = '28000';
  end if;

  select u.email, u.email_confirmed_at, u.raw_user_meta_data
    into v_email, v_confirmed, v_meta
    from auth.users u where u.id = v_uid;

  if v_email is null or v_confirmed is null then
    raise exception 'EMAIL_NAO_CONFIRMADO' using errcode = '28000';
  end if;

  select c.id, c.status into v_company_id, v_company_status
    from public.company c where c.slug = public.slugify(p_slug);
  if v_company_id is null then
    raise exception 'BARBEARIA_NAO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if v_company_status = 'suspended' then
    raise exception 'BARBEARIA_INDISPONIVEL' using errcode = '22023';
  end if;

  select ci.client_id into v_client_id
    from public.client_identity ci
   where ci.user_id = v_uid and ci.company_id = v_company_id;

  if v_client_id is null then
    -- Mesmo e-mail (verificado) = mesma pessoa. O cadastro mais antigo guarda
    -- o histórico e vira o dono do vínculo.
    select cl.id into v_client_id
      from public.client cl
     where cl.company_id = v_company_id
       and lower(btrim(cl.email)) = lower(v_email)
     order by cl.created_at
     limit 1;

    if v_client_id is null then
      v_name := btrim(coalesce(
        nullif(btrim(coalesce(p_name, '')), ''),
        v_meta->>'full_name',
        v_meta->>'name',
        split_part(v_email, '@', 1)
      ));
      if length(v_name) < 2 then v_name := split_part(v_email, '@', 1); end if;

      insert into public.client (company_id, name, phone, email)
      values (v_company_id, left(v_name, 120), v_phone, v_email)
      returning id into v_client_id;
    end if;

    insert into public.client_identity (user_id, company_id, client_id)
    values (v_uid, v_company_id, v_client_id)
    on conflict on constraint client_identity_user_company_key do nothing;

    select ci.client_id into v_client_id
      from public.client_identity ci
     where ci.user_id = v_uid and ci.company_id = v_company_id;
  end if;

  -- Telefone informado agora completa um cadastro que ainda não tinha.
  if v_phone is not null then
    update public.client cl set phone = v_phone, updated_at = now()
     where cl.id = v_client_id and nullif(btrim(coalesce(cl.phone, '')), '') is null;
  end if;

  return query
    select cl.id, cl.name, cl.email, cl.phone, c.id, c.name
      from public.client cl join public.company c on c.id = cl.company_id
     where cl.id = v_client_id;
end;
$$;

-- Os agendamentos do cliente autenticado nesta barbearia. O token de cada um
-- é o mesmo do link enviado na confirmação: a página do agendamento
-- (/[slug]/agendamentos/[token]) já cancela e avalia.
create or replace function public.get_my_client_appointments(p_slug text)
returns table (
  appointment_id uuid,
  status text,
  starts_at timestamptz,
  ends_at timestamptz,
  services text,
  professional_name text,
  client_access_token uuid
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_client_id uuid;
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO' using errcode = '28000';
  end if;

  select ci.client_id into v_client_id
    from public.client_identity ci
    join public.company c on c.id = ci.company_id
   where ci.user_id = v_uid and c.slug = public.slugify(p_slug);

  if v_client_id is null then
    raise exception 'CLIENTE_NAO_VINCULADO' using errcode = 'P0002';
  end if;

  return query
    select a.id,
           a.status,
           min(aps.starts_at),
           max(aps.ends_at),
           string_agg(s.name, ' + ' order by aps.starts_at),
           (array_agg(p.name order by aps.starts_at))[1],
           a.client_access_token
      from public.appointment a
      join public.appointment_service aps on aps.appointment_id = a.id
      join public.service s on s.id = aps.service_id
      join public.professional p on p.id = aps.professional_id
     where a.client_id = v_client_id
     group by a.id
     order by min(aps.starts_at) desc
     limit 60;
end;
$$;

-- Agendamento feito por um cliente autenticado: mesmas validações do
-- agendamento público (create_public_appointment_multi), mas o cliente vem da
-- identidade — nunca de um telefone digitado.
create or replace function public.create_client_appointment(
  p_slug text,
  p_service_ids uuid[],
  p_professional_id uuid,
  p_starts_at timestamptz,
  p_unit_id uuid default null
)
returns table (appointment_id uuid, client_access_token uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_company_status text;
  v_unit_id uuid;
  v_client_id uuid;
  v_appointment_id uuid;
  v_token uuid;
  v_cursor timestamptz;
  v_service_id uuid;
  v_duration int;
  v_item_ends timestamptz;
  v_matched int;
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO' using errcode = '28000';
  end if;
  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    raise exception 'AGENDAMENTO_SEM_SERVICOS' using errcode = '22023';
  end if;
  if p_starts_at <= now() then
    raise exception 'HORARIO_NO_PASSADO' using errcode = '22023';
  end if;

  select c.id, c.status into v_company_id, v_company_status
    from public.company c where c.slug = public.slugify(p_slug);
  if v_company_id is null then
    raise exception 'BARBEARIA_NAO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if v_company_status = 'suspended' then
    raise exception 'BARBEARIA_INDISPONIVEL' using errcode = '22023';
  end if;

  select ci.client_id into v_client_id
    from public.client_identity ci
   where ci.user_id = v_uid and ci.company_id = v_company_id;
  if v_client_id is null then
    raise exception 'CLIENTE_NAO_VINCULADO' using errcode = 'P0002';
  end if;

  if p_unit_id is not null then
    if not exists (select 1 from public.unit u where u.id = p_unit_id and u.company_id = v_company_id) then
      raise exception 'UNIDADE_INVALIDA' using errcode = '22023';
    end if;
    v_unit_id := p_unit_id;
  else
    select u.id into v_unit_id from public.unit u
     where u.company_id = v_company_id and u.status = 'active'
     order by u.created_at limit 1;
  end if;
  if v_unit_id is null then
    raise exception 'UNIDADE_NAO_CONFIGURADA' using errcode = 'P0002';
  end if;

  select count(*) into v_matched
    from public.service s
   where s.id = any(p_service_ids) and s.company_id = v_company_id and s.status = 'active' and s.is_public;
  if v_matched is distinct from array_length(p_service_ids, 1) then
    raise exception 'SERVICO_INVALIDO' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.professional p
     where p.id = p_professional_id and p.company_id = v_company_id and p.active
  ) then
    raise exception 'PROFISSIONAL_INVALIDO' using errcode = '22023';
  end if;

  if not exists (
    select 1
      from public.get_available_slots(
        v_company_id, v_unit_id, null::uuid,
        (p_starts_at at time zone 'America/Sao_Paulo')::date,
        p_professional_id, p_service_ids
      ) g
     where g.professional_id = p_professional_id and g.slot_start = p_starts_at
  ) then
    raise exception 'HORARIO_INDISPONIVEL' using errcode = '23P01';
  end if;

  insert into public.appointment as a (company_id, unit_id, client_id, status)
  values (v_company_id, v_unit_id, v_client_id, 'scheduled')
  returning a.id, a.client_access_token into v_appointment_id, v_token;

  v_cursor := p_starts_at;
  foreach v_service_id in array p_service_ids loop
    select planned_duration_minutes into v_duration
      from public.service_operational
     where id = v_service_id and company_id = v_company_id;

    v_item_ends := v_cursor + make_interval(mins => v_duration);

    begin
      insert into public.appointment_service (appointment_id, service_id, professional_id, starts_at, ends_at)
      values (v_appointment_id, v_service_id, p_professional_id, v_cursor, v_item_ends);
    exception when exclusion_violation or unique_violation then
      delete from public.appointment where id = v_appointment_id;
      raise exception 'HORARIO_INDISPONIVEL' using errcode = '23P01';
    end;

    v_cursor := v_item_ends;
  end loop;

  return query select v_appointment_id, v_token, p_starts_at, v_cursor;
end;
$$;

revoke all on function public.link_client_identity(text, text, text) from public, anon;
revoke all on function public.get_my_client_appointments(text) from public, anon;
revoke all on function public.create_client_appointment(text, uuid[], uuid, timestamptz, uuid) from public, anon;
grant execute on function public.link_client_identity(text, text, text) to authenticated;
grant execute on function public.get_my_client_appointments(text) to authenticated;
grant execute on function public.create_client_appointment(text, uuid[], uuid, timestamptz, uuid) to authenticated;
