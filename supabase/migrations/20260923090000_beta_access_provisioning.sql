-- CORTEX.OS — Beta: aprovar de verdade provisiona a conta.
--
-- Até aqui approve_beta_access_request só mudava o status (ver seção 6 de
-- docs/cortex-admin-fundacao.md — "fica fora desta rodada" de propósito).
-- Esta migration fecha esse gap SEM inventar um segundo sistema de conta:
-- reaproveita exatamente o que já existe —
--   * auth.users continua sendo a única fonte de identidade (criada via
--     Admin API do Supabase, nunca por INSERT direto — mesmo padrão de
--     actions/profissional-acesso.ts);
--   * company + user_company_role continuam sendo tenancy (mesmo desenho de
--     create_company_with_owner, só que parametrizado pelo usuário aprovado
--     em vez de auth.uid(), porque quem chama é o platform admin, não o
--     próprio dono);
--   * generate_available_company_slug/role('owner') são reaproveitados tal
--     como estão, zero duplicação.
--
-- Fica dividido em duas RPCs porque a criação da conta no Auth acontece do
-- lado do Node (supabase.auth.admin.createUser, via chave de serviço — SQL
-- não fala com o GoTrue) entre as duas chamadas:
--
--   1. platform_begin_beta_approval  — só leitura: valida platform admin e
--      solicitação pendente, devolve os dados do formulário e se já existe
--      auth.users para este e-mail (para NUNCA criar conta duplicada nem
--      sobrescrever senha de conta existente).
--   2. (Node cria ou reaproveita o usuário no Auth aqui, fora do banco)
--   3. platform_finalize_beta_approval — a parte transacional: cria a
--      empresa + vínculo owner quando faltam (reaproveita a empresa em que o
--      usuário já é owner, se houver), marca a solicitação como aprovada com
--      o período/validade do Beta, e só então grava a auditoria. Tudo numa
--      função só — se qualquer passo falhar, nada fica gravado.
--
-- Se o passo 3 falhar depois de uma conta nova ter sido criada no passo 2, o
-- Node desfaz a conta (auth.admin.deleteUser) antes de devolver o erro —
-- mesma filosofia de compensação já usada em
-- actions/profissional-acesso.ts:rollbackAccessRecord, só na ordem inversa
-- (aqui o efeito colateral que pode precisar ser desfeito é externo ao
-- banco, não uma linha local).

-- ---------------------------------------------------------------------------
-- 1. beta_access_requests: onde fica o resultado da provisão
-- ---------------------------------------------------------------------------
alter table public.beta_access_requests
  add column if not exists beta_period_months integer,
  add column if not exists beta_expires_at timestamptz,
  add column if not exists provisioned_user_id uuid references auth.users(id),
  add column if not exists provisioned_company_id uuid references public.company(id);

comment on column public.beta_access_requests.provisioned_user_id is
  'Conta de auth.users efetivamente vinculada a esta aprovação — criada nova ou reaproveitada de um e-mail já existente. Nunca nulo depois de approved.';
comment on column public.beta_access_requests.provisioned_company_id is
  'Empresa efetivamente vinculada a esta aprovação — nova ou reaproveitada de um vínculo owner que o usuário já tinha. Nunca nulo depois de approved.';

-- ---------------------------------------------------------------------------
-- 2. user_security_state — "esta conta precisa trocar a senha no próximo
--    login?", para contas com e-mail real (dono/gerência).
--
-- Profissionais já têm esse mecanismo (professional_access.password_set_at,
-- BLOCO B) mas ele é 1:1 com `professional`, amarrado ao login sintético por
-- identificador — não serve para uma conta de dono com e-mail próprio. Em
-- vez de forçar o vínculo errado, esta é a mesma ideia (null/true = precisa
-- trocar; a troca em si zera a flag), numa tabela 1:1 com auth.users, no
-- mesmo desenho de platform_admin: chave primária é o próprio user_id, sem
-- grant de escrita para authenticated — só é gravada de dentro de
-- platform_finalize_beta_approval (marca) e de
-- actions/auth.ts:completeMandatoryPasswordChange, via cliente
-- administrativo (limpa, depois que auth.updateUser já confirmou a troca).
-- ---------------------------------------------------------------------------
create table public.user_security_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  must_change_password boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.user_security_state is
  'Estado de segurança 1:1 com auth.users, independente de company. Hoje só guarda must_change_password (senha provisória entregue pelo platform admin no aprovar Beta); nunca guarda a senha em si.';

alter table public.user_security_state enable row level security;

-- Sem grant de INSERT/UPDATE/DELETE para authenticated: só a função
-- SECURITY DEFINER abaixo e o cliente administrativo (service role, que
-- ignora RLS) escrevem aqui — nunca o próprio usuário direto via REST,
-- para que ele não consiga se auto-liberar da troca obrigatória.
revoke all on public.user_security_state from anon, authenticated;
grant select on public.user_security_state to authenticated;

create policy user_security_state_select on public.user_security_state
  for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. platform_begin_beta_approval — leitura preparatória, platform admin only
-- ---------------------------------------------------------------------------
create or replace function public.platform_begin_beta_approval(p_id uuid)
returns table (
  request_email text,
  request_name text,
  request_barbershop_name text,
  request_phone text,
  request_region text,
  existing_user_id uuid,
  existing_owner_company_id uuid
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select status into v_status from public.beta_access_requests where id = p_id;
  if v_status is null then
    raise exception 'SOLICITACAO_NAO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    raise exception 'SOLICITACAO_JA_PROCESSADA' using errcode = '22023';
  end if;

  return query
    select
      bar.email,
      bar.name,
      bar.barbershop_name,
      bar.phone,
      bar.region,
      u.id as existing_user_id,
      (
        select ucr.company_id
        from public.user_company_role ucr
        join public.role r on r.id = ucr.role_id
        where ucr.user_id = u.id and r.key = 'owner'
        order by ucr.created_at asc
        limit 1
      ) as existing_owner_company_id
    from public.beta_access_requests bar
    left join auth.users u on lower(u.email) = lower(bar.email)
    where bar.id = p_id;
end;
$function$;

revoke all on function public.platform_begin_beta_approval(uuid) from public, anon;
grant execute on function public.platform_begin_beta_approval(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. platform_finalize_beta_approval — a parte atômica, platform admin only
-- ---------------------------------------------------------------------------
create or replace function public.platform_finalize_beta_approval(
  p_id uuid,
  p_user_id uuid,
  p_period_months integer,
  p_new_account boolean,
  p_reason text default null
)
returns table (
  company_id uuid,
  company_name text,
  company_slug text,
  beta_expires_at timestamptz
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_status text;
  v_barbershop text;
  v_email text;
  v_phone text;
  v_owner_role_id uuid;
  v_company_id uuid;
  v_company_name text;
  v_company_slug text;
  v_slug text;
  v_expires timestamptz;
  v_updated int;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'USUARIO_NAO_ENCONTRADO' using errcode = '22023';
  end if;
  if p_period_months is null or p_period_months < 1 or p_period_months > 24 then
    raise exception 'PERIODO_INVALIDO' using errcode = '22023';
  end if;

  -- Lock na linha: uma segunda chamada concorrente para o mesmo id espera
  -- aqui e, ao continuar, já vê o status atualizado pela primeira — cai no
  -- SOLICITACAO_JA_PROCESSADA abaixo em vez de duplicar a provisão.
  select status, barbershop_name, email, phone
    into v_status, v_barbershop, v_email, v_phone
    from public.beta_access_requests
    where id = p_id
    for update;

  if v_status is null then
    raise exception 'SOLICITACAO_NAO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    raise exception 'SOLICITACAO_JA_PROCESSADA' using errcode = '22023';
  end if;

  select id into v_owner_role_id from public.role where key = 'owner';
  if v_owner_role_id is null then
    raise exception 'OWNER_ROLE_MISSING';
  end if;

  -- Reaproveita a empresa em que este usuário já é owner, se houver — nunca
  -- cria uma segunda barbearia para quem já tem uma. Cobre tanto "conta
  -- existente já era dona de uma empresa" quanto uma segunda tentativa de
  -- aprovação (via retry) que já tinha criado a empresa antes.
  select ucr.company_id into v_company_id
    from public.user_company_role ucr
    where ucr.user_id = p_user_id and ucr.role_id = v_owner_role_id
    order by ucr.created_at asc
    limit 1;

  if v_company_id is null then
    v_slug := public.generate_available_company_slug(v_barbershop);

    insert into public.company (name, email, phone, created_by, slug)
    values (v_barbershop, v_email, v_phone, p_user_id, v_slug)
    returning id, name, slug into v_company_id, v_company_name, v_company_slug;

    insert into public.user_company_role (user_id, company_id, role_id)
    values (p_user_id, v_company_id, v_owner_role_id);
  else
    select c.name, c.slug into v_company_name, v_company_slug
      from public.company c
      where c.id = v_company_id;
  end if;

  v_expires := now() + (p_period_months::text || ' months')::interval;

  update public.beta_access_requests
    set status = 'approved',
        approved_at = now(),
        approved_by = auth.uid(),
        beta_period_months = p_period_months,
        beta_expires_at = v_expires,
        provisioned_user_id = p_user_id,
        provisioned_company_id = v_company_id
    where id = p_id and status = 'pending';

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    -- Só chega aqui se algo mudou o status entre o SELECT FOR UPDATE e este
    -- UPDATE dentro da mesma função, o que não deveria acontecer sob o lock
    -- acima — mantido como segunda trava, nunca confiar só no SELECT.
    raise exception 'SOLICITACAO_JA_PROCESSADA' using errcode = '22023';
  end if;

  -- Só marca troca obrigatória quando a conta nasceu agora com a senha
  -- provisória gerada por esta aprovação. Conta reaproveitada mantém a
  -- senha que já tinha — não é tocada aqui.
  if p_new_account then
    insert into public.user_security_state (user_id, must_change_password)
    values (p_user_id, true)
    on conflict (user_id) do update set must_change_password = true, updated_at = now();
  end if;

  perform public.write_platform_audit_log(
    'beta_request_approved', 'beta_access_request', p_id,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object(
      'status', 'approved',
      'company_id', v_company_id,
      'user_id', p_user_id,
      'period_months', p_period_months,
      'new_account', p_new_account
    ),
    p_reason
  );

  return query select v_company_id, v_company_name, v_company_slug, v_expires;
end;
$function$;

revoke all on function public.platform_finalize_beta_approval(uuid, uuid, integer, boolean, text) from public, anon;
grant execute on function public.platform_finalize_beta_approval(uuid, uuid, integer, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. approve_beta_access_request(uuid, text) fica substituída pelo par
--    begin/finalize acima — só mudava o status, nunca provisionava nada.
--    Mantê-la viva seria um segundo caminho de aprovação sem provisão, o
--    oposto do que esta rodada pede.
-- ---------------------------------------------------------------------------
drop function if exists public.approve_beta_access_request(uuid, text);
