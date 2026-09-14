-- P0.4 (achado ao testar ao vivo): assert_admin_write() bloqueava
-- prepare_account_deletion() tentando desvincular o próprio
-- professional.user_id — a trigger só liberava com has_company_management_
-- access(company_id), e quem está excluindo a conta pode ser staff, sem
-- esse acesso. A trigger já tinha um escape para auth.uid() is null
-- (contexto sem sessão); esta migration adiciona um segundo escape,
-- nomeado e estreito: uma GUC que só prepare_account_deletion() liga, só
-- ao redor do UPDATE em professional, nunca exposta a mais nenhum
-- caminho. Não afrouxa a trigger para nenhum outro caso.
create or replace function public.assert_admin_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_row jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  v_mode text := tg_argv[0];
  v_company uuid;
  v_changed text[];
begin
  if tg_op = 'UPDATE' and tg_table_name in ('product', 'consumable') then
    select coalesce(array_agg(e.key), '{}')
      into v_changed
      from jsonb_each(v_row) e
      where e.value is distinct from (to_jsonb(old) -> e.key);

    if v_changed <@ array['current_stock', 'updated_at'] then
      return new;
    end if;
  end if;

  if auth.uid() is null or coalesce(current_setting('cortex.self_service_detach', true), '') = 'true' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_company := case v_mode
    when 'self' then (v_row->>'id')::uuid
    when 'company' then (v_row->>'company_id')::uuid
    else null
  end;

  if v_mode = 'unit' then
    select u.company_id into v_company from public.unit u where u.id = (v_row->>'unit_id')::uuid;
  elsif v_mode = 'professional' then
    select p.company_id into v_company from public.professional p where p.id = (v_row->>'professional_id')::uuid;
  elsif v_mode = 'schedule' then
    select p.company_id into v_company
      from public.professional_schedule s join public.professional p on p.id = s.professional_id
      where s.id = (v_row->>'schedule_id')::uuid;
  end if;

  if v_company is null or not public.has_company_management_access(v_company) then
    raise exception 'ACESSO_ADMINISTRATIVO_NECESSARIO' using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

create or replace function public.prepare_account_deletion()
returns uuid[]
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_company_ids uuid[];
  v_company_id uuid;
  v_other_owners int;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select array_agg(company_id) into v_company_ids
  from user_company_role
  where user_id = v_user_id;

  for v_company_id in
    select ucr.company_id
    from user_company_role ucr
    join role r on r.id = ucr.role_id
    where ucr.user_id = v_user_id and r.key = 'owner'
  loop
    select count(*) into v_other_owners
    from user_company_role ucr2
    join role r2 on r2.id = ucr2.role_id
    where ucr2.company_id = v_company_id and r2.key = 'owner' and ucr2.user_id <> v_user_id;

    if v_other_owners = 0 then
      raise exception 'EMPRESA_SEM_OUTRO_RESPONSAVEL' using errcode = '22023';
    end if;
  end loop;

  perform set_config('cortex.self_service_detach', 'true', true);
  update professional
    set user_id = null, active = false
    where user_id = v_user_id;
  perform set_config('cortex.self_service_detach', 'false', true);

  update platform_admin
    set status = 'revoked', updated_at = now()
    where user_id = v_user_id and status = 'active';

  if v_company_ids is not null then
    foreach v_company_id in array v_company_ids loop
      perform write_audit_log(v_company_id, 'account_deleted', 'user', v_user_id, null,
        jsonb_build_object('deleted_at', now()), 'Exclusão de conta solicitada pelo próprio usuário');
    end loop;
  end if;

  delete from user_company_role where user_id = v_user_id;

  return coalesce(v_company_ids, array[]::uuid[]);
end;
$function$;
