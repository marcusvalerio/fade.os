-- CORTEX ADMIN — fundação: autorização de plataforma, acessos beta, auditoria.
--
-- Este é um nível de autorização NOVO e SEPARADO do multi-tenancy existente.
-- Ser owner/admin de uma company não concede nada aqui, e este nível não
-- depende de nenhuma company (nenhuma "empresa CORTEX" fake, nenhum
-- company_id de placeholder). A identidade continua sendo a mesma
-- auth.users de sempre — só ganha uma segunda pergunta possível: "esta
-- pessoa administra a plataforma?", independente de qualquer vínculo em
-- user_company_role.
--
-- Mesmo padrão já comprovado no resto do projeto (has_company_management_access
-- + RLS + RPC SECURITY DEFINER): a tabela de autorização não tem grant de
-- escrita para authenticated/anon — só duas RPCs escrevem nela, cada uma
-- com sua própria checagem de quem pode chamar. Ninguém insere o próprio
-- registro de admin por REST porque não existe policy nem grant que permita
-- isso, ponto.

-- ---------------------------------------------------------------------------
-- 1. platform_admin — quem administra a plataforma
-- ---------------------------------------------------------------------------
create table public.platform_admin (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

comment on table public.platform_admin is
  'Autorização de nível plataforma — independente de company. 1:1 com auth.users (chave primária é o próprio user_id). Nunca escrito direto: só grant_platform_admin/revoke_platform_admin, cada um exigindo que quem chama já seja platform admin ativo.';

alter table public.platform_admin enable row level security;

-- Sem grant de INSERT/UPDATE/DELETE para authenticated/anon — a única forma
-- de escrever aqui é dentro das RPCs abaixo, que rodam como dono da tabela.
revoke all on public.platform_admin from anon, authenticated;
grant select on public.platform_admin to authenticated;

-- ---------------------------------------------------------------------------
-- 2. is_platform_admin — o helper que tudo mais usa
-- ---------------------------------------------------------------------------
-- Mesmo desenho de has_company_management_access: STABLE + SECURITY DEFINER,
-- para poder ser chamado tanto de dentro de policies de RLS (sem recursão —
-- roda como dono da tabela, então não reavalia a própria RLS que a policy
-- está definindo) quanto do código da aplicação via .rpc().
create or replace function public.is_platform_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from public.platform_admin pa
    where pa.user_id = p_user_id and pa.status = 'active'
  );
$function$;

revoke all on function public.is_platform_admin(uuid) from public, anon;
grant execute on function public.is_platform_admin(uuid) to authenticated;

-- Agora que a função existe, a policy de leitura de platform_admin pode
-- usá-la: só platform admin ativo vê a lista de platform admins.
create policy platform_admin_select on public.platform_admin
  for select to authenticated
  using (public.is_platform_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. platform_audit_log — trilha das ações de nível plataforma
-- ---------------------------------------------------------------------------
-- Não é o mesmo audit_log do app operacional: aquele exige company_id
-- (NOT NULL) e só é gravável de dentro de funções que já validaram
-- `company_id in my_company_ids()` — não existe "empresa" aqui, e fingir uma
-- é exatamente o que foi pedido para não fazer. Um audit log próprio, do
-- mesmo tamanho do que este nível de autorização realmente precisa.
create table public.platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);

comment on table public.platform_audit_log is
  'Trilha de ações de nível plataforma (platform_admin, beta_access_requests). actor_id fica null quando o evento nasce de um visitante anônimo (ex.: submissão de solicitação de beta) — não é ausência de dado, é o ator de verdade daquele evento.';

alter table public.platform_audit_log enable row level security;
revoke all on public.platform_audit_log from anon, authenticated;
grant select on public.platform_audit_log to authenticated;

create policy platform_audit_log_select on public.platform_audit_log
  for select to authenticated
  using (public.is_platform_admin(auth.uid()));

-- Mesmo truque de write_audit_log: recusa ser chamada como RPC de primeiro
-- nível (pg_context precisa mostrar pelo menos duas funções PL/pgSQL na
-- pilha — quem grava e quem audita). Sem checagem de is_platform_admin aqui
-- dentro de propósito: quem decide se a chamada é legítima é cada função
-- que grava (submit_beta_access_request é pública por desenho; as de
-- aprovação/revogação já exigem platform admin antes de chegar aqui).
create or replace function public.write_platform_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid;
  v_stack text;
begin
  get diagnostics v_stack = pg_context;
  if array_length(string_to_array(v_stack, 'PL/pgSQL function'), 1) - 1 < 2 then
    raise exception 'AUDITORIA_NAO_CHAMAVEL_DIRETAMENTE' using errcode = '42501';
  end if;

  if p_action is null or length(btrim(p_action)) = 0 then
    raise exception 'ACAO_OBRIGATORIA' using errcode = '22023';
  end if;

  insert into public.platform_audit_log (actor_id, action, entity_type, entity_id, before, after, reason)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_before, p_after, p_reason)
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.write_platform_audit_log(text, text, uuid, jsonb, jsonb, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Conceder/revogar platform admin — as duas únicas portas de escrita
-- ---------------------------------------------------------------------------
create or replace function public.grant_platform_admin(p_user_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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

  insert into public.platform_admin (user_id, status, created_by)
  values (p_user_id, 'active', auth.uid())
  on conflict (user_id) do update set status = 'active', updated_at = now();

  perform public.write_platform_audit_log(
    'platform_admin_granted', 'platform_admin', p_user_id,
    null, jsonb_build_object('status', 'active'), p_reason
  );
end;
$function$;

create or replace function public.revoke_platform_admin(p_user_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  -- Ninguém revoga o próprio acesso por aqui — evita um platform admin
  -- solitário se trancar para fora sem querer.
  if p_user_id = auth.uid() then
    raise exception 'NAO_PODE_REVOGAR_A_SI_MESMO' using errcode = '22023';
  end if;
  if not exists (select 1 from public.platform_admin where user_id = p_user_id) then
    raise exception 'PLATFORM_ADMIN_NAO_ENCONTRADO' using errcode = 'P0002';
  end if;

  update public.platform_admin set status = 'revoked', updated_at = now() where user_id = p_user_id;

  perform public.write_platform_audit_log(
    'platform_admin_revoked', 'platform_admin', p_user_id,
    jsonb_build_object('status', 'active'), jsonb_build_object('status', 'revoked'), p_reason
  );
end;
$function$;

revoke all on function public.grant_platform_admin(uuid, text) from public, anon;
revoke all on function public.revoke_platform_admin(uuid, text) from public, anon;
grant execute on function public.grant_platform_admin(uuid, text) to authenticated;
grant execute on function public.revoke_platform_admin(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. beta_access_requests — a fila de solicitações do Beta
-- ---------------------------------------------------------------------------
create table public.beta_access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  barbershop_name text not null,
  phone text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'revoked')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  rejected_at timestamptz,
  rejected_by uuid references auth.users(id),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id)
);

comment on table public.beta_access_requests is
  'Solicitações de acesso ao Beta, da vitrine pública até a decisão do platform admin. Nenhuma senha nasce aqui — aprovar só muda o status; o convite/provisionamento de conta é etapa futura, fora desta rodada.';

-- E-mail comparado sempre normalizado (minúsculo, sem espaço nas pontas).
-- Índice único parcial: só há choque entre duas solicitações PENDENTES do
-- mesmo e-mail — uma pessoa rejeitada ou revogada pode solicitar de novo.
create unique index beta_access_requests_pending_email_uniq
  on public.beta_access_requests (lower(btrim(email)))
  where status = 'pending';

create index beta_access_requests_status_idx on public.beta_access_requests (status, created_at desc);

alter table public.beta_access_requests enable row level security;
revoke all on public.beta_access_requests from anon, authenticated;
grant select on public.beta_access_requests to authenticated;

create policy beta_access_requests_select on public.beta_access_requests
  for select to authenticated
  using (public.is_platform_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 6. Submeter solicitação — a única porta pública desta fundação inteira
-- ---------------------------------------------------------------------------
-- Chamável por anon: é o formulário da vitrine, ninguém está logado ainda.
-- Validação e normalização vivem aqui — nunca confiar em status/approved_by
-- vindo de fora, e como não há grant de INSERT direto na tabela, não existe
-- caminho alternativo para gravar um desses campos.
create or replace function public.submit_beta_access_request(
  p_email text,
  p_name text,
  p_barbershop_name text,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := btrim(coalesce(p_name, ''));
  v_barbershop text := btrim(coalesce(p_barbershop_name, ''));
  v_id uuid;
begin
  if v_email = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'EMAIL_INVALIDO' using errcode = '22023';
  end if;
  if v_name = '' then
    raise exception 'NOME_OBRIGATORIO' using errcode = '22023';
  end if;
  if v_barbershop = '' then
    raise exception 'NOME_BARBEARIA_OBRIGATORIO' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.beta_access_requests
    where lower(btrim(email)) = v_email and status = 'pending'
  ) then
    raise exception 'SOLICITACAO_JA_EXISTE' using errcode = '23505';
  end if;

  insert into public.beta_access_requests (email, name, barbershop_name, phone)
  values (v_email, v_name, v_barbershop, nullif(btrim(p_phone), ''))
  returning id into v_id;

  perform public.write_platform_audit_log(
    'beta_request_created', 'beta_access_request', v_id,
    null, jsonb_build_object('email', v_email, 'barbershop_name', v_barbershop), null
  );

  return v_id;
end;
$function$;

revoke all on function public.submit_beta_access_request(text, text, text, text) from public;
grant execute on function public.submit_beta_access_request(text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Aprovar / rejeitar / revogar — só platform admin
-- ---------------------------------------------------------------------------
create or replace function public.approve_beta_access_request(p_id uuid, p_reason text default null)
returns void
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

  update public.beta_access_requests
    set status = 'approved', approved_at = now(), approved_by = auth.uid()
    where id = p_id;

  perform public.write_platform_audit_log(
    'beta_request_approved', 'beta_access_request', p_id,
    jsonb_build_object('status', v_status), jsonb_build_object('status', 'approved'), p_reason
  );
end;
$function$;

create or replace function public.reject_beta_access_request(p_id uuid, p_reason text default null)
returns void
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

  update public.beta_access_requests
    set status = 'rejected', rejected_at = now(), rejected_by = auth.uid()
    where id = p_id;

  perform public.write_platform_audit_log(
    'beta_request_rejected', 'beta_access_request', p_id,
    jsonb_build_object('status', v_status), jsonb_build_object('status', 'rejected'), p_reason
  );
end;
$function$;

create or replace function public.revoke_beta_access_request(p_id uuid, p_reason text default null)
returns void
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
  if v_status <> 'approved' then
    raise exception 'SOLICITACAO_NAO_APROVADA' using errcode = '22023';
  end if;

  update public.beta_access_requests
    set status = 'revoked', revoked_at = now(), revoked_by = auth.uid()
    where id = p_id;

  perform public.write_platform_audit_log(
    'beta_request_revoked', 'beta_access_request', p_id,
    jsonb_build_object('status', v_status), jsonb_build_object('status', 'revoked'), p_reason
  );
end;
$function$;

revoke all on function public.approve_beta_access_request(uuid, text) from public, anon;
revoke all on function public.reject_beta_access_request(uuid, text) from public, anon;
revoke all on function public.revoke_beta_access_request(uuid, text) from public, anon;
grant execute on function public.approve_beta_access_request(uuid, text) to authenticated;
grant execute on function public.reject_beta_access_request(uuid, text) to authenticated;
grant execute on function public.revoke_beta_access_request(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Leituras administrativas cross-company — escopo mínimo, explícito
-- ---------------------------------------------------------------------------
-- `company`/`professional`/`user_company_role` continuam com a RLS de sempre
-- (escopo por my_company_ids()) — um platform admin não vira automaticamente
-- membro de nenhuma empresa. Estas duas funções são a única porta de leitura
-- cross-tenant, cada uma checando is_platform_admin por dentro, devolvendo só
-- a projeção mínima necessária para a tela — não uma função genérica que
-- aceita qualquer company_id e libera acesso amplo.
create or replace function public.admin_list_companies()
returns table (
  id uuid,
  name text,
  slug text,
  created_at timestamptz,
  onboarding_completed boolean,
  user_count bigint,
  professional_count bigint
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
    select
      c.id, c.name, c.slug, c.created_at,
      (c.onboarding_completed_at is not null) as onboarding_completed,
      (select count(*) from public.user_company_role ucr where ucr.company_id = c.id) as user_count,
      (select count(*) from public.professional p where p.company_id = c.id) as professional_count
    from public.company c
    order by c.created_at desc;
end;
$function$;

-- Só o mínimo de auth.users que uma visão administrativa precisa — nunca
-- encrypted_password, tokens ou metadata bruto.
create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed boolean
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
    select u.id, u.email::text, u.created_at, u.last_sign_in_at, (u.email_confirmed_at is not null)
    from auth.users u
    order by u.created_at desc;
end;
$function$;

revoke all on function public.admin_list_companies() from public, anon;
revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_companies() to authenticated;
grant execute on function public.admin_list_users() to authenticated;
