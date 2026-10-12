-- CORTEX ADMIN — sessão administrativa própria.
--
-- Antes: estar logado no CORTEX.OS como alguém que É platform admin bastava
-- para abrir o Admin. As duas áreas dividiam a mesma sessão do Supabase.
--
-- Agora: o Admin exige uma SESSÃO ADMINISTRATIVA, aberta só por /admin/login
-- e presa à sessão do Supabase daquele navegador (claim `session_id` do
-- token). Mesma pessoa, mesma conta — nenhuma conta nova.
--
--   * dura 8 h;
--   * sair do Admin encerra só ela (o CORTEX.OS continua logado);
--   * revogar o platform admin corta o acesso na hora (a checagem exige o
--     vínculo ativo a cada chamada, e o trigger encerra as sessões abertas);
--   * entrada, saída e acesso negado vão para platform_audit_log.
--
-- `is_platform_admin(uuid)` continua existindo para o que ela faz de verdade:
-- dizer se UMA PESSOA é admin (notificar, notificacao_tem_publico,
-- notificacao_publicos_do_usuario, admin_list_users_detailed). O que muda é
-- quem pode chamá-la: só funções internas. Antes, qualquer usuário logado
-- podia perguntar por qualquer id.
--
-- Guarda nova: `admin_sessao_valida()`, trocada em todas as funções que
-- perguntavam `is_platform_admin(auth.uid())` (48 hoje) e nas 4 políticas.
-- A troca é feita a partir da definição real de cada função no banco, e a
-- migration confere no fim que nenhuma ficou para trás.
--
-- VIRADA EM DUAS ETAPAS (produção e Preview usam o mesmo banco):
--   * `admin_sessao_ativa()` é a checagem estrita (admin ativo + sessão
--     administrativa válida). O código novo (middleware, layout, ações) usa
--     esta — a separação vale no app assim que o código novo está no ar.
--   * `admin_sessao_valida()` é a guarda do banco (funções admin_* e
--     políticas). Enquanto o ajuste `admin_sessao_obrigatoria` estiver
--     desligado, ela aceita também o admin sem sessão — é o que mantém o
--     Admin da produção (código antigo, que não abre sessão) funcionando até
--     o merge. Depois do merge, o próprio Admin liga a exigência
--     (`admin_exigir_sessao(true)`), que também fecha is_platform_admin para
--     a API. Desligar volta ao estado anterior.
--
-- MFA: a sessão guarda o `aal` do token. Exigir aal2 no futuro é trocar a
-- condição em admin_sessao_valida(); nada mais precisa mudar.

-- ---------------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------------
create table public.platform_admin_sessao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  auth_session_id uuid not null,
  aal text,
  criada_em timestamptz not null default now(),
  expira_em timestamptz not null,
  encerrada_em timestamptz,
  motivo_encerramento text check (motivo_encerramento in ('logout', 'substituida', 'admin_revogado'))
);

create index platform_admin_sessao_aberta on public.platform_admin_sessao (user_id, auth_session_id) where encerrada_em is null;

alter table public.platform_admin_sessao enable row level security;
revoke all on public.platform_admin_sessao from anon, authenticated;

-- Ajustes da plataforma (chave → valor). Só funções internas leem e escrevem.
create table public.plataforma_ajuste (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id)
);
alter table public.plataforma_ajuste enable row level security;
revoke all on public.plataforma_ajuste from anon, authenticated;
insert into public.plataforma_ajuste (chave, valor) values ('admin_sessao_obrigatoria', 'false'::jsonb);

-- ---------------------------------------------------------------------------
-- 2. As guardas
-- ---------------------------------------------------------------------------
-- Estrita: admin ativo E sessão administrativa válida neste navegador.
create or replace function public.admin_sessao_ativa()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
      select 1 from public.platform_admin pa
       where pa.user_id = auth.uid() and pa.status = 'active'
    )
    and exists (
      select 1 from public.platform_admin_sessao s
       where s.user_id = auth.uid()
         and s.auth_session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
         and s.encerrada_em is null
         and s.expira_em > now()
    );
$function$;

-- Guarda do banco: estrita quando a exigência está ligada; enquanto não
-- está, aceita o admin ativo sem sessão (compatibilidade com o código antigo).
-- A revogação vale nos dois modos: o vínculo ativo é sempre exigido.
create or replace function public.admin_sessao_valida()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select public.admin_sessao_ativa()
      or (
        not coalesce((select (a.valor)::boolean from public.plataforma_ajuste a where a.chave = 'admin_sessao_obrigatoria'), false)
        and exists (select 1 from public.platform_admin pa where pa.user_id = auth.uid() and pa.status = 'active')
      );
$function$;

-- "Eu sou platform admin?" — identidade, sem sessão. Para a tela de entrada
-- saber se oferece "confirme sua senha" ou "esta conta não administra".
create or replace function public.eu_sou_platform_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (select 1 from public.platform_admin pa where pa.user_id = auth.uid() and pa.status = 'active');
$function$;

revoke all on function public.admin_sessao_ativa() from public, anon;
revoke all on function public.admin_sessao_valida() from public, anon;
revoke all on function public.eu_sou_platform_admin() from public, anon;
grant execute on function public.admin_sessao_ativa() to authenticated;
grant execute on function public.admin_sessao_valida() to authenticated;
grant execute on function public.eu_sou_platform_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Abrir, encerrar, registrar acesso negado
-- ---------------------------------------------------------------------------
create or replace function public.admin_abrir_sessao()
returns timestamptz
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_sid uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  v_id uuid;
  v_expira timestamptz := now() + interval '8 hours';
begin
  if v_uid is null or v_sid is null then
    raise exception 'SEM_SESSAO' using errcode = '42501';
  end if;

  -- Quem não é admin não ganha sessão — e a tentativa fica registrada. Sem
  -- raise: um erro aqui desfaria o próprio registro da auditoria.
  if not exists (select 1 from public.platform_admin pa where pa.user_id = v_uid and pa.status = 'active') then
    perform public.write_platform_audit_log('admin.acesso_negado', 'auth_user', v_uid, null, jsonb_build_object('origem', 'login'), null);
    return null;
  end if;

  update public.platform_admin_sessao
     set encerrada_em = now(), motivo_encerramento = 'substituida'
   where user_id = v_uid and auth_session_id = v_sid and encerrada_em is null;

  insert into public.platform_admin_sessao (user_id, auth_session_id, aal, expira_em)
  values (v_uid, v_sid, auth.jwt() ->> 'aal', v_expira)
  returning id into v_id;

  perform public.write_platform_audit_log('admin.login', 'platform_admin_sessao', v_id, null, jsonb_build_object('expira_em', v_expira), null);
  return v_expira;
end;
$function$;

create or replace function public.admin_encerrar_sessao()
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid;
begin
  update public.platform_admin_sessao
     set encerrada_em = now(), motivo_encerramento = 'logout'
   where user_id = auth.uid()
     and auth_session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
     and encerrada_em is null
  returning id into v_id;

  if v_id is not null then
    perform public.write_platform_audit_log('admin.logout', 'platform_admin_sessao', v_id, null, null, null);
  end if;
  return v_id is not null;
end;
$function$;

-- Chamada pelo middleware quando alguém logado chega a /admin/* sem sessão
-- administrativa válida. Uma linha por pessoa a cada 10 min: recarregar a
-- página não enche a auditoria.
create or replace function public.admin_registrar_acesso_negado(p_rota text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;
  if exists (
    select 1 from public.platform_audit_log l
     where l.actor_id = v_uid and l.action = 'admin.acesso_negado' and l.created_at > now() - interval '10 minutes'
  ) then
    return;
  end if;
  perform public.write_platform_audit_log(
    'admin.acesso_negado', 'auth_user', v_uid, null,
    jsonb_build_object('rota', left(coalesce(p_rota, ''), 200),
                       'admin', exists (select 1 from public.platform_admin pa where pa.user_id = v_uid and pa.status = 'active')),
    null
  );
end;
$function$;

revoke all on function public.admin_abrir_sessao() from public, anon;
revoke all on function public.admin_encerrar_sessao() from public, anon;
revoke all on function public.admin_registrar_acesso_negado(text) from public, anon;
grant execute on function public.admin_abrir_sessao() to authenticated;
grant execute on function public.admin_encerrar_sessao() to authenticated;
grant execute on function public.admin_registrar_acesso_negado(text) to authenticated;

-- Revogação: encerra na hora as sessões administrativas abertas da pessoa.
-- (A guarda já exige o vínculo ativo; isto deixa o registro claro.)
create or replace function public.encerrar_sessoes_admin_revogado()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.status <> 'active' then
    update public.platform_admin_sessao
       set encerrada_em = now(), motivo_encerramento = 'admin_revogado'
     where user_id = new.user_id and encerrada_em is null;
  end if;
  return null;
end;
$function$;

revoke all on function public.encerrar_sessoes_admin_revogado() from public, anon, authenticated;

create trigger encerrar_sessoes_admin_revogado
  after update of status on public.platform_admin
  for each row when (old.status = 'active' and new.status is distinct from 'active')
  execute function public.encerrar_sessoes_admin_revogado();

-- ---------------------------------------------------------------------------
-- 4. Troca da guarda nas funções que checam QUEM ESTÁ LOGADO
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_def text;
  v_n int := 0;
begin
  for r in
    select p.oid
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname not in ('is_platform_admin', 'admin_sessao_valida', 'admin_sessao_ativa')
       and p.prosrc ~ 'is_platform_admin\(\s*auth\.uid\(\)\s*\)'
  loop
    v_def := regexp_replace(pg_get_functiondef(r.oid), 'is_platform_admin\(\s*auth\.uid\(\)\s*\)', 'admin_sessao_valida()', 'g');
    execute v_def;
    v_n := v_n + 1;
  end loop;
  if v_n < 48 then
    raise exception 'esperava trocar a guarda de pelo menos 48 funções, troquei %', v_n;
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname <> 'is_platform_admin'
       and p.prosrc ~ 'is_platform_admin\(\s*auth\.uid\(\)\s*\)'
  ) then
    raise exception 'sobrou função com a guarda antiga';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Políticas
-- ---------------------------------------------------------------------------
alter policy platform_admin_select on public.platform_admin using (public.admin_sessao_valida());
alter policy platform_audit_log_select on public.platform_audit_log using (public.admin_sessao_valida());
alter policy beta_access_requests_select on public.beta_access_requests using (public.admin_sessao_valida());
alter policy notificacao_propria on public.notificacao
  using (user_id = auth.uid() and (publico <> 'plataforma' or public.admin_sessao_valida()));

-- ---------------------------------------------------------------------------
-- 6. Ligar/desligar a exigência (depois do merge, pelo próprio Admin)
-- ---------------------------------------------------------------------------
-- Ligar também fecha is_platform_admin para `authenticated`: nenhuma política
-- a usa mais e toda função que a chama é SECURITY DEFINER, então só a
-- pergunta "fulano é admin?" feita direto pela API deixa de funcionar. O
-- código antigo (que chama is_platform_admin pela API) para junto — por
-- isso isto só se liga depois que o código novo está em produção.
-- Só quem está com sessão administrativa ESTRITA pode ligar ou desligar.
create or replace function public.admin_exigir_sessao(p_ligar boolean)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_antes boolean;
begin
  if not public.admin_sessao_ativa() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select (valor)::boolean into v_antes from public.plataforma_ajuste where chave = 'admin_sessao_obrigatoria';
  update public.plataforma_ajuste
     set valor = to_jsonb(p_ligar), atualizado_em = now(), atualizado_por = auth.uid()
   where chave = 'admin_sessao_obrigatoria';
  if p_ligar then
    execute 'revoke execute on function public.is_platform_admin(uuid) from authenticated';
  else
    execute 'grant execute on function public.is_platform_admin(uuid) to authenticated';
  end if;
  perform public.write_platform_audit_log('admin.exigir_sessao', 'plataforma_ajuste', null,
    jsonb_build_object('ligada', v_antes), jsonb_build_object('ligada', p_ligar), null);
  return p_ligar;
end;
$function$;

create or replace function public.admin_sessao_obrigatoria()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce((select (a.valor)::boolean from public.plataforma_ajuste a where a.chave = 'admin_sessao_obrigatoria'), false);
$function$;

revoke all on function public.admin_exigir_sessao(boolean) from public, anon;
revoke all on function public.admin_sessao_obrigatoria() from public, anon;
grant execute on function public.admin_exigir_sessao(boolean) to authenticated;
grant execute on function public.admin_sessao_obrigatoria() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Limpeza: sessões administrativas com mais de 90 dias
-- ---------------------------------------------------------------------------
select cron.schedule('plataforma-admin-sessoes-limpeza', '31 4 * * *', $$
  delete from public.platform_admin_sessao where criada_em < now() - interval '90 days'
$$);
