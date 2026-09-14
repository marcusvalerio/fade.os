-- P0.4: exclusão de conta, sem apagar histórico comercial da empresa.
--
-- EXCLUIR CONTA != EXCLUIR EMPRESA: nenhuma linha de company, sale,
-- sale_item, commission, attendance_item ou financial_entry é tocada.
-- Todas essas tabelas referenciam professional.id (9 FKs verificadas),
-- nunca professional.user_id ou auth.users diretamente — então desvincular
-- o login (professional.user_id = null) preserva 100% do histórico.
--
-- Bloqueia quando a conta é a ÚNICA owner de alguma empresa: sem isso a
-- empresa ficaria sem ninguém que possa geri-la. Quem quiser mesmo assim
-- precisa primeiro promover outro owner (fora do escopo desta função).
--
-- platform_admin é revogado aqui (não via revoke_platform_admin, que
-- bloqueia auto-revogação de propósito para uso operacional — exclusão de
-- conta é uma decisão diferente: a conta inteira deixa de existir).
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

  -- Preserva o registro (e tudo que referencia professional.id); só solta
  -- o vínculo de login e marca inativo, igual a um profissional desligado.
  update professional
    set user_id = null, active = false
    where user_id = v_user_id;

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

revoke all on function public.prepare_account_deletion() from public, anon;
grant execute on function public.prepare_account_deletion() to authenticated;
