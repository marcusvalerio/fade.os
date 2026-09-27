-- CORTEX ADMIN como central de operação do produto.
--
-- Cinco leituras novas, todas SECURITY DEFINER com a mesma porta de sempre:
-- só quem está ativo em platform_admin (is_platform_admin) passa; qualquer
-- outro recebe FORBIDDEN. Nenhuma escreve nada. Nenhum dado é estimado:
-- cada número é uma contagem ou soma sobre tabelas reais.
--
--   admin_platform_overview(p_days)   totais da plataforma, janela de dias e
--                                     série semanal (12 semanas)
--   admin_company_activity(p_days)    uma linha por empresa: tamanho,
--                                     movimento no período, última atividade
--   admin_module_usage(p_days)        como o CORTEX está sendo usado: por
--                                     módulo, quantas empresas e registros
--   admin_list_users_detailed()       contas com vínculos, papel, método da
--                                     última sessão e se também são cliente
--   admin_audit_feed(p_limit)         ações de plataforma e de empresa numa
--                                     linha do tempo só

create or replace function public.admin_platform_overview(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_desde timestamptz := now() - make_interval(days => greatest(p_days, 1));
  v_resultado jsonb;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  with atividade as (
    select company_id from public.sale where created_at >= v_desde
    union select company_id from public.appointment where created_at >= v_desde
    union select company_id from public.attendance where created_at >= v_desde
  ),
  semanas as (
    select generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') as semana
  )
  select jsonb_build_object(
    'dias', p_days,
    'empresas', (select count(*) from public.company),
    'empresas_ativas', (select count(*) from public.company where status = 'active'),
    'empresas_suspensas', (select count(*) from public.company where status = 'suspended'),
    'empresas_novas', (select count(*) from public.company where created_at >= v_desde),
    'empresas_com_movimento', (select count(distinct company_id) from atividade),
    'empresas_sem_onboarding', (select count(*) from public.company where onboarding_completed_at is null),
    'usuarios', (select count(*) from auth.users),
    'usuarios_ativos', (select count(*) from auth.users where last_sign_in_at >= v_desde),
    'usuarios_novos', (select count(*) from auth.users where created_at >= v_desde),
    'profissionais', (select count(*) from public.professional where active),
    'clientes', (select count(*) from public.client),
    'contas_de_cliente', (select count(*) from public.client_identity),
    'agendamentos', (select count(*) from public.appointment),
    'agendamentos_periodo', (select count(*) from public.appointment where created_at >= v_desde),
    'atendimentos_periodo', (select count(*) from public.attendance where status = 'completed' and created_at >= v_desde),
    'vendas_periodo', (select count(*) from public.sale where status = 'completed' and created_at >= v_desde),
    'receita_periodo', coalesce((select sum(total) from public.sale where status = 'completed' and created_at >= v_desde), 0),
    'receita_total', coalesce((select sum(total) from public.sale where status = 'completed'), 0),
    'beta_pendentes', (select count(*) from public.beta_access_requests where status = 'pending'),
    'serie', coalesce((
      select jsonb_agg(jsonb_build_object(
        'semana', to_char(s.semana, 'YYYY-MM-DD'),
        'empresas_novas', (select count(*) from public.company c where date_trunc('week', c.created_at) = s.semana),
        'agendamentos', (select count(*) from public.appointment a where date_trunc('week', a.created_at) = s.semana),
        'atendimentos', (select count(*) from public.attendance t where t.status = 'completed' and date_trunc('week', t.created_at) = s.semana),
        'receita', coalesce((select sum(v.total) from public.sale v where v.status = 'completed' and date_trunc('week', v.created_at) = s.semana), 0)
      ) order by s.semana)
      from semanas s
    ), '[]'::jsonb)
  ) into v_resultado;

  return v_resultado;
end;
$function$;

create or replace function public.admin_company_activity(p_days int default 30)
returns table(
  id uuid, name text, slug text, status text, created_at timestamptz, onboarding_completed boolean,
  usuarios bigint, profissionais bigint, clientes bigint,
  agendamentos_periodo bigint, atendimentos_periodo bigint, receita_periodo numeric, receita_total numeric,
  ultima_atividade timestamptz, modulos_usados int
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_desde timestamptz := now() - make_interval(days => greatest(p_days, 1));
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
    select
      c.id, c.name, c.slug, c.status, c.created_at, c.onboarding_completed_at is not null,
      (select count(*) from public.user_company_role r where r.company_id = c.id),
      (select count(*) from public.professional p where p.company_id = c.id and p.active),
      (select count(*) from public.client cl where cl.company_id = c.id),
      (select count(*) from public.appointment a where a.company_id = c.id and a.created_at >= v_desde),
      (select count(*) from public.attendance t where t.company_id = c.id and t.status = 'completed' and t.created_at >= v_desde),
      coalesce((select sum(v.total) from public.sale v where v.company_id = c.id and v.status = 'completed' and v.created_at >= v_desde), 0),
      coalesce((select sum(v.total) from public.sale v where v.company_id = c.id and v.status = 'completed'), 0),
      greatest(
        (select max(v.created_at) from public.sale v where v.company_id = c.id),
        (select max(a.created_at) from public.appointment a where a.company_id = c.id),
        (select max(t.updated_at) from public.attendance t where t.company_id = c.id),
        (select max(cs.opened_at) from public.cash_session cs where cs.company_id = c.id)
      ),
      (
        (exists (select 1 from public.appointment a where a.company_id = c.id and a.created_at >= v_desde))::int
        + (exists (select 1 from public.attendance t where t.company_id = c.id and t.created_at >= v_desde))::int
        + (exists (select 1 from public.sale v where v.company_id = c.id and v.attendance_id is null and v.created_at >= v_desde))::int
        + (exists (select 1 from public.cash_session cs where cs.company_id = c.id and cs.opened_at >= v_desde))::int
        + (exists (select 1 from public.stock_movement m where m.company_id = c.id and m.reference_type is null and m.created_at >= v_desde))::int
        + (exists (select 1 from public.financial_entry f where f.company_id = c.id and f.reference_type is null and f.created_at >= v_desde))::int
        + (exists (select 1 from public.client cl where cl.company_id = c.id and cl.created_at >= v_desde))::int
      )::int
    from public.company c
    order by c.created_at desc;
end;
$function$;

create or replace function public.admin_module_usage(p_days int default 30)
returns table(modulo text, empresas bigint, registros bigint, ultima timestamptz)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_desde timestamptz := now() - make_interval(days => greatest(p_days, 1));
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
    select 'Agenda'::text, count(distinct a.company_id), count(*), max(a.created_at)
      from public.appointment a where a.created_at >= v_desde
    union all
    select 'Reagendamento', count(distinct l.company_id), count(*), max(l.created_at)
      from public.audit_log l where l.action = 'reschedule_appointment' and l.created_at >= v_desde
    union all
    select 'Atendimento', count(distinct t.company_id), count(*), max(t.created_at)
      from public.attendance t where t.created_at >= v_desde
    union all
    select 'Nova venda (balcão)', count(distinct v.company_id), count(*), max(v.created_at)
      from public.sale v where v.attendance_id is null and v.created_at >= v_desde
    union all
    select 'Caixa', count(distinct cs.company_id), count(*), max(cs.opened_at)
      from public.cash_session cs where cs.opened_at >= v_desde
    union all
    select 'Estoque (lançamento manual)', count(distinct m.company_id), count(*), max(m.created_at)
      from public.stock_movement m where m.reference_type is null and m.created_at >= v_desde
    union all
    select 'Financeiro (lançamento manual)', count(distinct f.company_id), count(*), max(f.created_at)
      from public.financial_entry f where f.reference_type is null and f.created_at >= v_desde
    union all
    select 'Comissões pagas', count(distinct c.company_id), count(*), max(c.paid_at)
      from public.commission c where c.status = 'paid' and c.paid_at >= v_desde
    union all
    select 'Clientes cadastrados', count(distinct cl.company_id), count(*), max(cl.created_at)
      from public.client cl where cl.created_at >= v_desde
    union all
    select 'Conta do cliente', count(distinct ci.company_id), count(*), max(ci.created_at)
      from public.client_identity ci where ci.created_at >= v_desde
    union all
    select 'Avaliações', count(distinct r.company_id), count(*), max(r.created_at)
      from public.attendance_rating r where r.created_at >= v_desde;
end;
$function$;

create or replace function public.admin_list_users_detailed()
returns table(
  id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, email_confirmed boolean,
  providers text[], ultimo_metodo text, empresas jsonb, cliente_em bigint, is_platform_admin boolean, banido boolean
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
      u.id,
      u.email::text,
      u.created_at,
      u.last_sign_in_at,
      u.email_confirmed_at is not null,
      coalesce((select array_agg(distinct i.provider order by i.provider) from auth.identities i where i.user_id = u.id), '{}'),
      (
        select m.authentication_method::text
        from auth.sessions s
        join auth.mfa_amr_claims m on m.session_id = s.id
        where s.user_id = u.id
        order by s.created_at desc
        limit 1
      ),
      coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.name, 'papel', r.key) order by c.name)
        from public.user_company_role ucr
        join public.company c on c.id = ucr.company_id
        join public.role r on r.id = ucr.role_id
        where ucr.user_id = u.id
      ), '[]'::jsonb),
      (select count(*) from public.client_identity ci where ci.user_id = u.id),
      public.is_platform_admin(u.id),
      u.banned_until is not null and u.banned_until > now()
    from auth.users u
    order by u.last_sign_in_at desc nulls last;
end;
$function$;

create or replace function public.admin_audit_feed(p_limit int default 150)
returns table(origem text, acao text, entidade text, empresa text, ator text, motivo text, criado_em timestamptz)
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
    select * from (
      select 'plataforma'::text, p.action, p.entity_type,
        (select c.name from public.company c where c.id = p.entity_id),
        (select u.email::text from auth.users u where u.id = p.actor_id),
        p.reason, p.created_at
      from public.platform_audit_log p
      union all
      select 'empresa'::text, l.action, l.entity_type,
        (select c.name from public.company c where c.id = l.company_id),
        (select u.email::text from auth.users u where u.id = l.user_id),
        l.reason, l.created_at
      from public.audit_log l
    ) x
    order by 7 desc
    limit least(greatest(p_limit, 1), 500);
end;
$function$;

revoke all on function public.admin_platform_overview(int) from public, anon;
revoke all on function public.admin_company_activity(int) from public, anon;
revoke all on function public.admin_module_usage(int) from public, anon;
revoke all on function public.admin_list_users_detailed() from public, anon;
revoke all on function public.admin_audit_feed(int) from public, anon;
grant execute on function public.admin_platform_overview(int) to authenticated;
grant execute on function public.admin_company_activity(int) to authenticated;
grant execute on function public.admin_module_usage(int) to authenticated;
grant execute on function public.admin_list_users_detailed() to authenticated;
grant execute on function public.admin_audit_feed(int) to authenticated;
