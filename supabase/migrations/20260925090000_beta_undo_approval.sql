-- CORTEX.OS — Beta: desfazer uma aprovação que nunca chegou a provisionar.
--
-- Caso real que motivou isto: solicitações aprovadas pelo approve_beta_
-- access_request ANTIGO (antes de 20260923090000_beta_access_provisioning)
-- ficaram com status='approved', beta_period_months/beta_expires_at
-- preenchidos, mas provisioned_user_id/provisioned_company_id NULOS — a
-- aprovação nunca criou conta nem empresa de verdade. Não há como
-- "continuar" essa aprovação pelo fluxo novo (ele exige pending), e não há
-- nada para desfazer no Auth/company porque nada foi criado lá.
--
-- platform_undo_beta_approval devolve a solicitação a pending para que o
-- platform admin possa aprová-la de novo pelo fluxo real
-- (platform_begin_beta_approval/platform_finalize_beta_approval). Só age
-- quando NADA foi provisionado — nunca desfaz uma aprovação que já criou
-- conta/empresa (para isso existe revoke_beta_access_request, que
-- deliberadamente não mexe na conta já criada).
create or replace function public.platform_undo_beta_approval(
  p_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_status text;
  v_provisioned_user_id uuid;
  v_provisioned_company_id uuid;
  v_email text;
  v_period_months integer;
  v_expires_at timestamptz;
  v_updated int;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- Lock na linha: mesma proteção contra corrida usada em
  -- platform_finalize_beta_approval/platform_finalize_beta_password_reset.
  select status, provisioned_user_id, provisioned_company_id, email, beta_period_months, beta_expires_at
    into v_status, v_provisioned_user_id, v_provisioned_company_id, v_email, v_period_months, v_expires_at
    from public.beta_access_requests
    where id = p_id
    for update;

  if v_status is null then
    raise exception 'SOLICITACAO_NAO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if v_status <> 'approved' then
    raise exception 'SOLICITACAO_BETA_NAO_APROVADA_PARA_DESFAZER' using errcode = '22023';
  end if;
  -- A trava real: só desfaz quando NADA foi provisionado. Uma aprovação com
  -- conta/empresa de verdade nunca pode voltar a pending por aqui — usar
  -- revoke_beta_access_request para tirar o acesso sem mexer na conta.
  if v_provisioned_user_id is not null or v_provisioned_company_id is not null then
    raise exception 'SOLICITACAO_JA_PROVISIONADA' using errcode = '22023';
  end if;

  -- Sem isso, um e-mail com outra solicitação pendente em aberto colidiria
  -- com o índice único parcial (lower(btrim(email)) where status='pending')
  -- assim que o UPDATE tentasse voltar esta linha para pending.
  if exists (
    select 1 from public.beta_access_requests
    where lower(btrim(email)) = lower(btrim(v_email))
      and status = 'pending'
      and id <> p_id
  ) then
    raise exception 'SOLICITACAO_PENDENTE_DUPLICADA' using errcode = '23505';
  end if;

  update public.beta_access_requests
    set status = 'pending',
        approved_at = null,
        approved_by = null,
        beta_period_months = null,
        beta_expires_at = null
    where id = p_id
      and status = 'approved'
      and provisioned_user_id is null
      and provisioned_company_id is null;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'SOLICITACAO_JA_PROVISIONADA' using errcode = '22023';
  end if;

  perform public.write_platform_audit_log(
    'beta_request_approval_undone', 'beta_access_request', p_id,
    jsonb_build_object('status', 'approved', 'beta_period_months', v_period_months, 'beta_expires_at', v_expires_at),
    jsonb_build_object('status', 'pending'),
    p_reason
  );
end;
$function$;

revoke all on function public.platform_undo_beta_approval(uuid, text) from public, anon;
grant execute on function public.platform_undo_beta_approval(uuid, text) to authenticated;
