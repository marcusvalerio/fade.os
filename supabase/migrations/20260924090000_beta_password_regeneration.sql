-- CORTEX.OS — Beta: regenerar a senha provisória de uma conta já aprovada.
--
-- O platform admin só vê a senha provisória UMA VEZ, na hora da aprovação
-- (20260923090000_beta_access_provisioning.sql). Se perder — ou se o dono
-- perder — não existe como recuperá-la (por desenho: nunca fica em texto
-- puro em lugar nenhum). Esta migration dá a única saída legítima: gerar
-- uma senha NOVA para a mesma conta já provisionada.
--
-- Mesmo desenho de duas RPCs da aprovação, pelo mesmo motivo: trocar a
-- senha de verdade é uma chamada à Admin API do GoTrue
-- (admin.auth.admin.updateUserById), que só existe do lado do Node — SQL
-- não fala com o GoTrue.
--
--   1. platform_begin_beta_password_reset — só leitura: valida platform
--      admin, solicitação aprovada, conta provisionada e que essa conta
--      ainda existe em auth.users (a própria fonte que o GoTrue usa — não
--      é um cache separado, então esta checagem em SQL É a checagem real
--      contra o Supabase Auth).
--   2. (Node troca a senha no Auth aqui, fora do banco)
--   3. platform_finalize_beta_password_reset — marca
--      user_security_state.must_change_password = true e grava a
--      auditoria (nunca a senha).
--
-- Nada aqui cria usuário, empresa, vínculo ou solicitação nova — só
-- redefine a senha da conta que a aprovação já vinculou. Reaproveita
-- is_platform_admin/write_platform_audit_log/user_security_state tal como
-- estão, zero duplicação.

create or replace function public.platform_begin_beta_password_reset(p_id uuid)
returns table (
  provisioned_user_id uuid,
  email text,
  company_id uuid,
  company_name text
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_status text;
  v_user_id uuid;
  v_company_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- Colunas da tabela qualificadas de propósito: RETURNS TABLE acima
  -- declara provisioned_user_id/company_id como variáveis de saída, que do
  -- contrário colidiriam (referência ambígua) com as colunas de mesmo nome
  -- em beta_access_requests.
  select bar.status, bar.provisioned_user_id, bar.provisioned_company_id
    into v_status, v_user_id, v_company_id
    from public.beta_access_requests bar
    where bar.id = p_id;

  if v_status is null then
    raise exception 'SOLICITACAO_NAO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if v_status <> 'approved' then
    raise exception 'SOLICITACAO_BETA_NAO_APROVADA' using errcode = '22023';
  end if;
  if v_user_id is null then
    raise exception 'SOLICITACAO_SEM_CONTA_PROVISIONADA' using errcode = '22023';
  end if;

  -- auth.users É a tabela que o GoTrue lê/escreve, não um espelho — esta
  -- checagem equivale a perguntar diretamente ao Supabase Auth se a conta
  -- ainda existe (ex.: não foi apagada manualmente no painel depois da
  -- aprovação).
  if not exists (select 1 from auth.users where id = v_user_id) then
    raise exception 'USUARIO_PROVISIONADO_NAO_ENCONTRADO' using errcode = 'P0002';
  end if;

  return query
    select
      v_user_id,
      u.email::text,
      v_company_id,
      c.name
    from auth.users u
    left join public.company c on c.id = v_company_id
    where u.id = v_user_id;
end;
$function$;

revoke all on function public.platform_begin_beta_password_reset(uuid) from public, anon;
grant execute on function public.platform_begin_beta_password_reset(uuid) to authenticated;

create or replace function public.platform_finalize_beta_password_reset(
  p_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_status text;
  v_provisioned_user_id uuid;
  v_company_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select bar.status, bar.provisioned_user_id, bar.provisioned_company_id
    into v_status, v_provisioned_user_id, v_company_id
    from public.beta_access_requests bar
    where bar.id = p_id;

  if v_status is null then
    raise exception 'SOLICITACAO_NAO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if v_status <> 'approved' then
    raise exception 'SOLICITACAO_BETA_NAO_APROVADA' using errcode = '22023';
  end if;
  -- p_user_id vem do Node, mas nunca é confiado sozinho: precisa bater com
  -- o que esta própria solicitação tem gravado como conta provisionada —
  -- nunca marca must_change_password/audita para um id arbitrário passado
  -- direto à RPC.
  if v_provisioned_user_id is null or v_provisioned_user_id <> p_user_id then
    raise exception 'SOLICITACAO_SEM_CONTA_PROVISIONADA' using errcode = '22023';
  end if;

  insert into public.user_security_state (user_id, must_change_password)
  values (p_user_id, true)
  on conflict (user_id) do update set must_change_password = true, updated_at = now();

  perform public.write_platform_audit_log(
    'beta_access_temporary_password_regenerated', 'beta_access_request', p_id,
    null,
    jsonb_build_object(
      'user_id', p_user_id,
      'company_id', v_company_id,
      'regenerated_at', now()
    ),
    null
  );
end;
$function$;

revoke all on function public.platform_finalize_beta_password_reset(uuid, uuid) from public, anon;
grant execute on function public.platform_finalize_beta_password_reset(uuid, uuid) to authenticated;
