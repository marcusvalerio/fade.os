-- Admin: pulso da plataforma por janela (hoje, 7 e 30 dias) comparado com a
-- janela anterior do mesmo tamanho, e a matriz de uso módulo × empresa.
--
-- Só métricas que têm carimbo de tempo em tabela real. "Quem entrou" NÃO
-- está aqui: auth.users guarda só o último login e o log de auditoria do
-- Auth está vazio — não há como comparar períodos sem inventar.
--
-- Também fora: agendamento online × feito pela equipe. appointment não
-- guarda a origem, então essa divisão não é medida.
--
-- "Hoje" é o dia de Brasília até agora; o anterior é ontem até a mesma hora.

create or replace function public.admin_pulso_da_plataforma(p_janela text default '7d')
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_agora timestamptz := now();
  v_ini timestamptz;
  v_ini_ant timestamptz;
  v_fim_ant timestamptz;
  v_resultado jsonb;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_janela = 'hoje' then
    v_ini := (date_trunc('day', v_agora at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
    v_ini_ant := v_ini - interval '1 day';
    v_fim_ant := v_agora - interval '1 day';
  elsif p_janela = '30d' then
    v_ini := v_agora - interval '30 days';
    v_ini_ant := v_agora - interval '60 days';
    v_fim_ant := v_ini;
  else
    v_ini := v_agora - interval '7 days';
    v_ini_ant := v_agora - interval '14 days';
    v_fim_ant := v_ini;
  end if;

  with janelas(nome, ini, fim) as (
    values ('atual', v_ini, v_agora), ('anterior', v_ini_ant, v_fim_ant)
  ),
  medidas as (
    select j.nome, jsonb_build_object(
      'empresas_com_movimento', (
        select count(distinct x.company_id) from (
          select company_id from public.appointment where created_at >= j.ini and created_at < j.fim
          union select company_id from public.attendance where created_at >= j.ini and created_at < j.fim
          union select company_id from public.sale where created_at >= j.ini and created_at < j.fim
          union select company_id from public.cash_session where opened_at >= j.ini and opened_at < j.fim
        ) x),
      'agendamentos', (select count(*) from public.appointment where created_at >= j.ini and created_at < j.fim),
      'atendimentos', (select count(*) from public.attendance where status = 'completed' and created_at >= j.ini and created_at < j.fim),
      'vendas', (select count(*) from public.sale where status = 'completed' and created_at >= j.ini and created_at < j.fim),
      'receita', coalesce((select sum(total) from public.sale where status = 'completed' and created_at >= j.ini and created_at < j.fim), 0),
      'empresas_novas', (select count(*) from public.company where created_at >= j.ini and created_at < j.fim),
      'contas_de_cliente_novas', (select count(*) from public.client_identity where created_at >= j.ini and created_at < j.fim),
      'clientes_novos', (select count(*) from public.client where created_at >= j.ini and created_at < j.fim),
      'pesquisas_respondidas', (select count(*) from public.pesquisa_participacao where respondida_em >= j.ini and respondida_em < j.fim),
      'pedidos_beta', (select count(*) from public.beta_access_requests where created_at >= j.ini and created_at < j.fim)
    ) as m
    from janelas j
  ),
  dias as (
    select generate_series(
      (date_trunc('day', v_agora at time zone 'America/Sao_Paulo') - interval '29 days'),
      date_trunc('day', v_agora at time zone 'America/Sao_Paulo'),
      interval '1 day'
    ) as dia
  )
  select jsonb_build_object(
    'janela', p_janela,
    'inicio', v_ini,
    'inicio_anterior', v_ini_ant,
    'fim_anterior', v_fim_ant,
    'atual', (select m from medidas where nome = 'atual'),
    'anterior', (select m from medidas where nome = 'anterior'),
    'usuarios_que_entraram', (select count(*) from auth.users where last_sign_in_at >= v_ini),
    'beta_pendentes', (select count(*) from public.beta_access_requests where status = 'pending'),
    -- 30 dias, um ponto por dia de Brasília: base das linhas de tendência
    'serie', coalesce((
      select jsonb_agg(jsonb_build_object(
        'dia', to_char(d.dia, 'YYYY-MM-DD'),
        'agendamentos', (select count(*) from public.appointment a where (a.created_at at time zone 'America/Sao_Paulo')::date = d.dia::date),
        'atendimentos', (select count(*) from public.attendance t where t.status = 'completed' and (t.created_at at time zone 'America/Sao_Paulo')::date = d.dia::date),
        'receita', coalesce((select sum(v.total) from public.sale v where v.status = 'completed' and (v.created_at at time zone 'America/Sao_Paulo')::date = d.dia::date), 0),
        'empresas_com_movimento', (
          select count(distinct x.company_id) from (
            select company_id from public.appointment where (created_at at time zone 'America/Sao_Paulo')::date = d.dia::date
            union select company_id from public.attendance where (created_at at time zone 'America/Sao_Paulo')::date = d.dia::date
            union select company_id from public.sale where (created_at at time zone 'America/Sao_Paulo')::date = d.dia::date
          ) x)
      ) order by d.dia)
      from dias d
    ), '[]'::jsonb)
  ) into v_resultado;

  return v_resultado;
end;
$function$;

-- Matriz de uso: para cada empresa, quantos registros em cada módulo no
-- período. Mesmos módulos de admin_module_usage, pela mesma regra.
create or replace function public.admin_matriz_de_uso(p_days int default 30)
returns table(company_id uuid, name text, status text, onboarding_completed boolean, criada_em timestamptz, uso jsonb)
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
    with registros(cid, modulo, n) as (
      select a.company_id, 'Agenda', count(*) from public.appointment a where a.created_at >= v_desde group by 1
      union all
      select l.company_id, 'Reagendamento', count(*) from public.audit_log l where l.action in ('reschedule_appointment', 'client_reschedule_appointment') and l.created_at >= v_desde group by 1
      union all
      select t.company_id, 'Atendimento', count(*) from public.attendance t where t.created_at >= v_desde group by 1
      union all
      select v.company_id, 'Nova venda (balcão)', count(*) from public.sale v where v.attendance_id is null and v.created_at >= v_desde group by 1
      union all
      select cs.company_id, 'Caixa', count(*) from public.cash_session cs where cs.opened_at >= v_desde group by 1
      union all
      select m.company_id, 'Estoque (manual)', count(*) from public.stock_movement m where m.reference_type is null and m.created_at >= v_desde group by 1
      union all
      select f.company_id, 'Financeiro (manual)', count(*) from public.financial_entry f where f.reference_type is null and f.created_at >= v_desde group by 1
      union all
      select c.company_id, 'Comissões pagas', count(*) from public.commission c where c.status = 'paid' and c.paid_at >= v_desde group by 1
      union all
      select cl.company_id, 'Clientes cadastrados', count(*) from public.client cl where cl.created_at >= v_desde group by 1
      union all
      select ci.company_id, 'Conta do cliente', count(*) from public.client_identity ci where ci.created_at >= v_desde group by 1
      union all
      select r.company_id, 'Avaliações', count(*) from public.attendance_rating r where r.created_at >= v_desde group by 1
    )
    select c.id, c.name, c.status, c.onboarding_completed_at is not null, c.created_at,
           coalesce((select jsonb_object_agg(r.modulo, r.n) from registros r where r.cid = c.id), '{}'::jsonb)
      from public.company c
     order by c.created_at;
end;
$function$;

revoke all on function public.admin_pulso_da_plataforma(text) from public, anon;
revoke all on function public.admin_matriz_de_uso(int) from public, anon;
grant execute on function public.admin_pulso_da_plataforma(text) to authenticated;
grant execute on function public.admin_matriz_de_uso(int) to authenticated;
