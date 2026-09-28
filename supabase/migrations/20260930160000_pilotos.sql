-- Pilotos — acompanhamento interno de uso de uma barbearia por N dias.
--
-- Camada só de OBSERVAÇÃO: nada aqui escreve em tabela operacional. As
-- métricas são calculadas por funções STABLE (o Postgres recusa INSERT,
-- UPDATE ou DELETE dentro delas) sobre os dados reais; o que é gravado vai
-- só para piloto, piloto_snapshot e piloto_atividade. A barbearia não vê
-- nada disto: RLS ligado sem política e leitura só por função que exige
-- platform_admin ativo.
--
--   piloto            — empresa, período (início/fim), status
--   piloto_atividade  — quem esteve com sessão ativa em cada hora (o
--                       Supabase não guarda histórico de login; só o último)
--   piloto_snapshot   — um retrato por dia (Dia 0 = véspera do início, a
--                       base de comparação), em jsonb versionado
--
-- Coleta (pg_cron): de hora em hora registra sessões e atualiza o retrato
-- parcial de hoje; logo depois da meia-noite (São Paulo) fecha o dia
-- anterior e muda o status pela data. Os jobs se chamam plataforma-* e já
-- entram no monitoramento de verificar_plataforma(). Queda de uso NÃO vira
-- notificação: fica no painel do Admin.

-- ---------------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------------
create table public.piloto (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 3 and 90),
  objetivo text check (objetivo is null or length(objetivo) <= 500),
  inicio date not null,
  fim date not null,
  status text not null default 'planejado' check (status in ('planejado', 'ativo', 'encerrado', 'cancelado')),
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  encerrado_em timestamptz,
  encerrado_por uuid references auth.users(id) on delete set null,
  motivo_encerramento text check (motivo_encerramento is null or length(motivo_encerramento) <= 300),
  check (fim >= inicio and fim - inicio <= 89)
);
-- um piloto aberto por empresa
create unique index piloto_aberto_por_empresa on public.piloto (company_id) where status in ('planejado', 'ativo');

create table public.piloto_snapshot (
  piloto_id uuid not null references public.piloto(id) on delete cascade,
  dia date not null,
  -- 0 = véspera do início (base); 1..N = dias do piloto
  dia_do_piloto int not null check (dia_do_piloto >= 0),
  -- false enquanto o dia está aberto (atualizado de hora em hora)
  final boolean not null default false,
  -- true quando o fechamento rodou depois do dia seguinte (os números do
  -- dia estão certos; o "estado" — estoque, atendimentos abertos — é do
  -- momento da captura)
  atrasado boolean not null default false,
  versao int not null default 1,
  capturado_em timestamptz not null default now(),
  metricas jsonb not null,
  primary key (piloto_id, dia)
);

create table public.piloto_atividade (
  piloto_id uuid not null references public.piloto(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- hora cheia (UTC) em que a sessão esteve ativa
  hora timestamptz not null,
  primary key (piloto_id, user_id, hora)
);
create index piloto_atividade_hora_idx on public.piloto_atividade (piloto_id, hora);

alter table public.piloto enable row level security;
alter table public.piloto_snapshot enable row level security;
alter table public.piloto_atividade enable row level security;
revoke all on public.piloto, public.piloto_snapshot, public.piloto_atividade from anon, authenticated;
-- sem política: ninguém lê direto; o Admin lê pelas funções abaixo

-- ---------------------------------------------------------------------------
-- 2. Uso por módulo numa janela — as MESMAS regras de admin_matriz_de_uso
--    (registro criado por módulo), recortadas por início e fim.
-- ---------------------------------------------------------------------------
create or replace function public.uso_por_modulo(p_company uuid, p_desde timestamptz, p_ate timestamptz)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(jsonb_object_agg(x.modulo, x.n) filter (where x.n > 0), '{}'::jsonb) from (
    select 'Agenda' as modulo, (select count(*) from public.appointment a where a.company_id = p_company and a.created_at >= p_desde and a.created_at < p_ate) as n
    union all select 'Reagendamento', (select count(*) from public.audit_log l where l.company_id = p_company and l.action in ('reschedule_appointment', 'client_reschedule_appointment') and l.created_at >= p_desde and l.created_at < p_ate)
    union all select 'Atendimento', (select count(*) from public.attendance t where t.company_id = p_company and t.created_at >= p_desde and t.created_at < p_ate)
    union all select 'Nova venda (balcão)', (select count(*) from public.sale v where v.company_id = p_company and v.attendance_id is null and v.created_at >= p_desde and v.created_at < p_ate)
    union all select 'Caixa', (select count(*) from public.cash_session cs where cs.company_id = p_company and cs.opened_at >= p_desde and cs.opened_at < p_ate)
    union all select 'Estoque (manual)', (select count(*) from public.stock_movement m where m.company_id = p_company and m.reference_type is null and m.created_at >= p_desde and m.created_at < p_ate)
    union all select 'Financeiro (manual)', (select count(*) from public.financial_entry f where f.company_id = p_company and f.reference_type is null and f.created_at >= p_desde and f.created_at < p_ate)
    union all select 'Comissões pagas', (select count(*) from public.commission c where c.company_id = p_company and c.status = 'paid' and c.paid_at >= p_desde and c.paid_at < p_ate)
    union all select 'Clientes cadastrados', (select count(*) from public.client cl where cl.company_id = p_company and cl.created_at >= p_desde and cl.created_at < p_ate)
    union all select 'Conta do cliente', (select count(*) from public.client_identity ci where ci.company_id = p_company and ci.created_at >= p_desde and ci.created_at < p_ate)
    union all select 'Avaliações', (select count(*) from public.attendance_rating r where r.company_id = p_company and r.created_at >= p_desde and r.created_at < p_ate)
  ) x;
$function$;

-- Quem é da empresa: papéis de acesso + profissionais com login.
create or replace function public.piloto_usuarios(p_company uuid)
returns table(user_id uuid, papel text, professional_id uuid, profissional text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select u.user_id,
         (array_agg(u.papel order by case u.papel when 'owner' then 1 when 'admin' then 2 when 'staff' then 3 else 4 end))[1],
         (array_agg(u.professional_id) filter (where u.professional_id is not null))[1],
         (array_agg(u.profissional) filter (where u.profissional is not null))[1]
    from (
      select ucr.user_id, r.key as papel, null::uuid as professional_id, null::text as profissional
        from public.user_company_role ucr join public.role r on r.id = ucr.role_id
       where ucr.company_id = p_company
      union all
      select pr.user_id, 'profissional', pr.id, pr.name
        from public.professional pr
       where pr.company_id = p_company and pr.user_id is not null
    ) u
   group by u.user_id;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Métricas de um dia (fuso de São Paulo). STABLE: não consegue escrever.
-- ---------------------------------------------------------------------------
-- Contagens "do dia" usam a data do registro dentro do dia. Métricas de
-- "estado" (estoque abaixo do mínimo, atendimentos abertos há mais de 24 h,
-- caixa aberto, comissões a pagar, totais acumulados) são do momento da
-- captura — por isso o dia só é fechado logo depois da meia-noite.
create or replace function public.piloto_metricas(p_company uuid, p_dia date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_tz constant text := 'America/Sao_Paulo';
  v_ini timestamptz := (p_dia::timestamp at time zone v_tz);
  v_fim timestamptz := ((p_dia + 1)::timestamp at time zone v_tz);
  v_ref timestamptz := least(now(), (p_dia + 1)::timestamp at time zone v_tz);
  v_usuarios jsonb;
  v_modulos jsonb;
  v_horas int[];
  v_horas_sessao int[];
  v_resultado jsonb;
begin
  -- ---------------------------------------------------------------- usuários
  with us as (
    select pu.*, au.email, au.last_sign_in_at
      from public.piloto_usuarios(p_company) pu join auth.users au on au.id = pu.user_id
  ),
  sessao as (
    select pa.user_id, count(distinct pa.hora) as horas
      from public.piloto_atividade pa join public.piloto p on p.id = pa.piloto_id
     where p.company_id = p_company and pa.hora >= v_ini and pa.hora < v_fim
     group by pa.user_id
  ),
  acoes as (
    select l.user_id, count(*) as n
      from public.audit_log l
     where l.company_id = p_company and l.user_id is not null and l.created_at >= v_ini and l.created_at < v_fim
     group by l.user_id
  ),
  autores as (
    select s.created_by as user_id from public.sale s where s.company_id = p_company and s.created_at >= v_ini and s.created_at < v_fim
    union select cs.opened_by from public.cash_session cs where cs.company_id = p_company and cs.opened_at >= v_ini and cs.opened_at < v_fim
    union select cs.closed_by from public.cash_session cs where cs.company_id = p_company and cs.closed_at >= v_ini and cs.closed_at < v_fim
    union select m.created_by from public.stock_movement m where m.company_id = p_company and m.reference_type is null and m.created_at >= v_ini and m.created_at < v_fim
    union select f.created_by from public.financial_entry f where f.company_id = p_company and f.reference_type is null and f.created_at >= v_ini and f.created_at < v_fim
  ),
  linhas as (
    select us.user_id, us.papel, us.professional_id, us.profissional, us.last_sign_in_at,
           coalesce(se.horas, 0) as horas, coalesce(ac.n, 0) as acoes,
           (coalesce(se.horas, 0) > 0
             or (us.last_sign_in_at >= v_ini and us.last_sign_in_at < v_fim)
             or coalesce(ac.n, 0) > 0
             or exists (select 1 from autores a where a.user_id = us.user_id)) as ativo,
           case when us.last_sign_in_at is null then null
                else greatest(0, floor(extract(epoch from v_ref - us.last_sign_in_at) / 86400))::int end as dias_sem_acesso
      from us
      left join sessao se on se.user_id = us.user_id
      left join acoes ac on ac.user_id = us.user_id
  )
  select jsonb_build_object(
    'total', count(*),
    'ativos', count(*) filter (where ativo),
    'nunca_entraram', count(*) filter (where last_sign_in_at is null),
    'sem_acesso_7', count(*) filter (where dias_sem_acesso between 7 and 9),
    'sem_acesso_10', count(*) filter (where dias_sem_acesso >= 10),
    'ultimo_acesso', max(last_sign_in_at) filter (where last_sign_in_at < v_fim),
    'por_usuario', coalesce(jsonb_agg(jsonb_build_object(
        'user_id', user_id, 'papel', papel, 'professional_id', professional_id, 'profissional', profissional,
        'ultimo_acesso', last_sign_in_at, 'dias_sem_acesso', dias_sem_acesso,
        'horas_ativas', horas, 'acoes', acoes, 'ativo', ativo) order by papel, profissional), '[]'::jsonb)
  ) into v_usuarios
  from linhas;

  -- ------------------------------------------------------ módulos e horários
  v_modulos := public.uso_por_modulo(p_company, v_ini, v_fim);

  with eventos(ts) as (
    select a.created_at from public.appointment a where a.company_id = p_company and a.created_at >= v_ini and a.created_at < v_fim
    union all select l.created_at from public.audit_log l where l.company_id = p_company and l.action in ('reschedule_appointment', 'client_reschedule_appointment') and l.created_at >= v_ini and l.created_at < v_fim
    union all select t.created_at from public.attendance t where t.company_id = p_company and t.created_at >= v_ini and t.created_at < v_fim
    union all select v.created_at from public.sale v where v.company_id = p_company and v.attendance_id is null and v.created_at >= v_ini and v.created_at < v_fim
    union all select cs.opened_at from public.cash_session cs where cs.company_id = p_company and cs.opened_at >= v_ini and cs.opened_at < v_fim
    union all select m.created_at from public.stock_movement m where m.company_id = p_company and m.reference_type is null and m.created_at >= v_ini and m.created_at < v_fim
    union all select f.created_at from public.financial_entry f where f.company_id = p_company and f.reference_type is null and f.created_at >= v_ini and f.created_at < v_fim
    union all select c.paid_at from public.commission c where c.company_id = p_company and c.status = 'paid' and c.paid_at >= v_ini and c.paid_at < v_fim
    union all select cl.created_at from public.client cl where cl.company_id = p_company and cl.created_at >= v_ini and cl.created_at < v_fim
    union all select ci.created_at from public.client_identity ci where ci.company_id = p_company and ci.created_at >= v_ini and ci.created_at < v_fim
    union all select r.created_at from public.attendance_rating r where r.company_id = p_company and r.created_at >= v_ini and r.created_at < v_fim
  )
  select array_agg(coalesce(e.n, 0)::int order by h.h) into v_horas
    from generate_series(0, 23) as h(h)
    left join (select extract(hour from ts at time zone v_tz)::int as hh, count(*) as n from eventos group by 1) e on e.hh = h.h;

  select array_agg(coalesce(s.n, 0)::int order by h.h) into v_horas_sessao
    from generate_series(0, 23) as h(h)
    left join (
      select extract(hour from pa.hora at time zone v_tz)::int as hh, count(distinct pa.user_id) as n
        from public.piloto_atividade pa join public.piloto p on p.id = pa.piloto_id
       where p.company_id = p_company and pa.hora >= v_ini and pa.hora < v_fim
       group by 1) s on s.hh = h.h;

  -- ---------------------------------------------------------------- restante
  with ag as (
    select a.id, a.status, a.created_at, a.updated_at,
           (select min(s.starts_at) from public.appointment_service s where s.appointment_id = a.id) as comeca
      from public.appointment a where a.company_id = p_company
  ),
  vendas as (
    select * from public.sale s where s.company_id = p_company
  ),
  ultima_operacao as (
    select max(ts) as ts from (
      select max(a.created_at) as ts from public.appointment a where a.company_id = p_company and a.created_at < v_ref
      union all select max(t.created_at) from public.attendance t where t.company_id = p_company and t.created_at < v_ref
      union all select max(s.created_at) from public.sale s where s.company_id = p_company and s.created_at < v_ref
      union all select max(cs.opened_at) from public.cash_session cs where cs.company_id = p_company and cs.opened_at < v_ref
      union all select max(m.created_at) from public.stock_movement m where m.company_id = p_company and m.created_at < v_ref
      union all select max(cl.created_at) from public.client cl where cl.company_id = p_company and cl.created_at < v_ref
    ) x
  )
  select jsonb_build_object(
    'versao', 1,
    'dia', p_dia,
    'janela', jsonb_build_object('inicio', v_ini, 'fim', v_fim, 'estado_em', v_ref),
    'usuarios', v_usuarios,
    'profissionais', jsonb_build_object(
      'cadastrados_ativos', (select count(*) from public.professional pr where pr.company_id = p_company and pr.active),
      'com_login', (select count(*) from public.professional pr where pr.company_id = p_company and pr.active and pr.user_id is not null),
      'com_login_ativos_no_dia', (select count(*) from jsonb_array_elements(v_usuarios -> 'por_usuario') u
                                   where u ->> 'professional_id' is not null and (u ->> 'ativo')::boolean),
      'atendendo_no_dia', (select count(distinct x.pid) from (
          select ai.professional_id as pid from public.attendance_item ai join public.attendance t on t.id = ai.attendance_id
           where t.company_id = p_company and ai.professional_id is not null and coalesce(ai.started_at, ai.created_at) >= v_ini and coalesce(ai.started_at, ai.created_at) < v_fim
          union
          select s.professional_id from public.appointment_service s join public.appointment a on a.id = s.appointment_id
           where a.company_id = p_company and s.professional_id is not null and s.starts_at >= v_ini and s.starts_at < v_fim
             and a.status not in ('cancelled_by_client', 'cancelled_by_company')) x)
    ),
    'clientes', jsonb_build_object(
      'total', (select count(*) from public.client c where c.company_id = p_company and c.created_at < v_fim),
      'novos', (select count(*) from public.client c where c.company_id = p_company and c.created_at >= v_ini and c.created_at < v_fim),
      'contas_total', (select count(*) from public.client_identity ci where ci.company_id = p_company and ci.created_at < v_fim),
      'contas_novas', (select count(*) from public.client_identity ci where ci.company_id = p_company and ci.created_at >= v_ini and ci.created_at < v_fim)
    ),
    'agendamentos', jsonb_build_object(
      'criados', (select count(*) from ag where ag.created_at >= v_ini and ag.created_at < v_fim),
      'para_o_dia', (select count(*) from ag where ag.comeca >= v_ini and ag.comeca < v_fim),
      'realizados', (select count(*) from ag where ag.comeca >= v_ini and ag.comeca < v_fim and ag.status = 'completed'),
      'cancelados', (select count(*) from ag where ag.status in ('cancelled_by_client', 'cancelled_by_company') and ag.updated_at >= v_ini and ag.updated_at < v_fim),
      'nao_compareceu', (select count(*) from ag where ag.status = 'no_show' and ag.updated_at >= v_ini and ag.updated_at < v_fim),
      'passados_sem_fechamento', (select count(*) from ag where ag.status in ('scheduled', 'confirmed', 'arrived') and ag.comeca < v_ref - interval '2 hours')
    ),
    'atendimentos', jsonb_build_object(
      'abertos', (select count(*) from public.attendance t where t.company_id = p_company and t.created_at >= v_ini and t.created_at < v_fim),
      'concluidos', (select count(distinct s.attendance_id) from vendas s where s.attendance_id is not null and s.status = 'completed' and s.created_at >= v_ini and s.created_at < v_fim),
      'cancelados', (select count(*) from public.attendance t where t.company_id = p_company and t.status = 'cancelled' and t.updated_at >= v_ini and t.updated_at < v_fim),
      'em_andamento_24h', (select count(*) from public.attendance t where t.company_id = p_company and t.status = 'in_progress' and t.created_at < v_ref - interval '24 hours')
    ),
    'vendas', jsonb_build_object(
      'concluidas', (select count(*) from vendas s where s.status = 'completed' and s.created_at >= v_ini and s.created_at < v_fim),
      'valor', (select coalesce(sum(s.total), 0) from vendas s where s.status = 'completed' and s.created_at >= v_ini and s.created_at < v_fim),
      'balcao', (select count(*) from vendas s where s.status = 'completed' and s.attendance_id is null and s.created_at >= v_ini and s.created_at < v_fim),
      'canceladas', (select count(*) from vendas s where s.status = 'cancelled' and s.cancelled_at >= v_ini and s.cancelled_at < v_fim),
      'valor_cancelado', (select coalesce(sum(s.total), 0) from vendas s where s.status = 'cancelled' and s.cancelled_at >= v_ini and s.cancelled_at < v_fim),
      'por_metodo', coalesce((select jsonb_object_agg(p.method, p.v) from (
          select pg.method, sum(pg.amount) as v from public.payment pg
           where pg.company_id = p_company and pg.status = 'confirmed' and pg.created_at >= v_ini and pg.created_at < v_fim group by pg.method) p), '{}'::jsonb),
      'estornos', (select count(*) from public.payment pg where pg.company_id = p_company and pg.refunded_at >= v_ini and pg.refunded_at < v_fim),
      'valor_estornado', (select coalesce(sum(pg.amount), 0) from public.payment pg where pg.company_id = p_company and pg.refunded_at >= v_ini and pg.refunded_at < v_fim)
    ),
    'caixa', jsonb_build_object(
      'abertos', (select count(*) from public.cash_session cs where cs.company_id = p_company and cs.opened_at >= v_ini and cs.opened_at < v_fim),
      'fechados', (select count(*) from public.cash_session cs where cs.company_id = p_company and cs.closed_at >= v_ini and cs.closed_at < v_fim),
      'com_diferenca', (select count(*) from public.cash_session cs where cs.company_id = p_company and cs.closed_at >= v_ini and cs.closed_at < v_fim and coalesce(cs.difference, 0) <> 0),
      'diferenca_total', (select coalesce(sum(cs.difference), 0) from public.cash_session cs where cs.company_id = p_company and cs.closed_at >= v_ini and cs.closed_at < v_fim),
      'abertos_agora', (select count(*) from public.cash_session cs where cs.company_id = p_company and cs.status = 'open' and cs.opened_at < v_ref)
    ),
    'comissoes', jsonb_build_object(
      'geradas', (select count(*) from public.commission c where c.company_id = p_company and c.created_at >= v_ini and c.created_at < v_fim),
      'valor_gerado', (select coalesce(sum(c.amount), 0) from public.commission c where c.company_id = p_company and c.created_at >= v_ini and c.created_at < v_fim),
      'pagas', (select count(*) from public.commission c where c.company_id = p_company and c.paid_at >= v_ini and c.paid_at < v_fim),
      'valor_pago', (select coalesce(sum(c.amount), 0) from public.commission c where c.company_id = p_company and c.paid_at >= v_ini and c.paid_at < v_fim),
      'revertidas', (select count(*) from public.commission c where c.company_id = p_company and c.reversed_at >= v_ini and c.reversed_at < v_fim),
      'a_pagar_total', (select coalesce(sum(c.amount), 0) from public.commission c where c.company_id = p_company and c.status = 'due' and c.created_at < v_ref)
    ),
    'estoque', jsonb_build_object(
      'movimentacoes', (select count(*) from public.stock_movement m where m.company_id = p_company and m.created_at >= v_ini and m.created_at < v_fim),
      'por_tipo', coalesce((select jsonb_object_agg(x.movement_type, x.n) from (
          select m.movement_type, count(*) as n from public.stock_movement m
           where m.company_id = p_company and m.created_at >= v_ini and m.created_at < v_fim group by 1) x), '{}'::jsonb),
      'abaixo_do_minimo', (select count(*) from public.product p where p.company_id = p_company and p.active and p.minimum_stock > 0 and p.current_stock <= p.minimum_stock)
                        + (select count(*) from public.consumable c where c.company_id = p_company and c.active and c.minimum_stock > 0 and c.current_stock <= c.minimum_stock),
      'negativos', (select count(*) from public.product p where p.company_id = p_company and p.active and p.current_stock < 0)
                 + (select count(*) from public.consumable c where c.company_id = p_company and c.active and c.current_stock < 0)
    ),
    'financeiro_manual', jsonb_build_object(
      'lancamentos', (select count(*) from public.financial_entry f where f.company_id = p_company and f.reference_type is null and f.created_at >= v_ini and f.created_at < v_fim),
      'receitas', (select coalesce(sum(f.amount), 0) from public.financial_entry f where f.company_id = p_company and f.reference_type is null and f.type = 'income' and f.created_at >= v_ini and f.created_at < v_fim),
      'despesas', (select coalesce(sum(f.amount), 0) from public.financial_entry f where f.company_id = p_company and f.reference_type is null and f.type = 'expense' and f.created_at >= v_ini and f.created_at < v_fim)
    ),
    'notificacoes', jsonb_build_object(
      'geradas', (select count(*) from public.notificacao n where n.company_id = p_company and n.criada_em >= v_ini and n.criada_em < v_fim),
      'lidas', (select count(*) from public.notificacao n where n.company_id = p_company and n.lida_em >= v_ini and n.lida_em < v_fim),
      'abertas', (select count(*) from public.notificacao n where n.company_id = p_company and n.aberta_em >= v_ini and n.aberta_em < v_fim),
      'push', coalesce((select jsonb_object_agg(x.status, x.n) from (
          select e.status, count(*) as n from public.notificacao_entrega e join public.notificacao n on n.id = e.notificacao_id
           where n.company_id = p_company and e.canal = 'push' and e.criada_em >= v_ini and e.criada_em < v_fim group by 1) x), '{}'::jsonb)
    ),
    'modulos', v_modulos,
    'modulos_usados', (select count(*) from jsonb_object_keys(v_modulos)),
    'operacoes', (select coalesce(sum(value::int), 0) from jsonb_each_text(v_modulos)),
    'horas', to_jsonb(v_horas),
    'horas_sessao', to_jsonb(v_horas_sessao),
    'incidentes', jsonb_build_object(
      'avisos_plataforma', (select count(distinct regexp_replace(n.chave_unica, ':[0-9a-f-]{36}$', '')) from public.notificacao n
                             where n.publico = 'plataforma' and n.dados ->> 'empresa' = p_company::text and n.criada_em >= v_ini and n.criada_em < v_fim),
      'jobs_com_falha', (select count(*) from cron.job_run_details d where d.status = 'failed' and d.start_time >= v_ini and d.start_time < v_fim),
      'push_falhas', (select count(*) from public.notificacao_entrega e join public.notificacao n on n.id = e.notificacao_id
                       where n.company_id = p_company and e.canal = 'push' and e.status = 'falhou' and e.criada_em >= v_ini and e.criada_em < v_fim)
    ),
    'acumulado', jsonb_build_object(
      'clientes', (select count(*) from public.client c where c.company_id = p_company and c.created_at < v_fim),
      'agendamentos', (select count(*) from ag where ag.created_at < v_fim),
      'atendimentos', (select count(*) from public.attendance t where t.company_id = p_company and t.created_at < v_fim),
      'vendas', (select count(*) from vendas s where s.status = 'completed' and s.created_at < v_fim),
      'valor_vendido', (select coalesce(sum(s.total), 0) from vendas s where s.status = 'completed' and s.created_at < v_fim),
      'comissoes', (select coalesce(sum(c.amount), 0) from public.commission c where c.company_id = p_company and c.status <> 'reversed' and c.created_at < v_fim),
      'movimentacoes_estoque', (select count(*) from public.stock_movement m where m.company_id = p_company and m.created_at < v_fim),
      'notificacoes', (select count(*) from public.notificacao n where n.company_id = p_company and n.criada_em < v_fim)
    ),
    'inatividade', jsonb_build_object(
      'sem_uso_no_dia', ((v_usuarios ->> 'ativos')::int = 0 and (select coalesce(sum(value::int), 0) from jsonb_each_text(v_modulos)) = 0),
      'ultima_operacao', (select ts from ultima_operacao),
      'dias_sem_operacao', (select case when ts is null then null else floor(extract(epoch from v_ref - ts) / 86400)::int end from ultima_operacao),
      'dias_sem_acesso', case when v_usuarios ->> 'ultimo_acesso' is null then null
                              else floor(extract(epoch from v_ref - (v_usuarios ->> 'ultimo_acesso')::timestamptz) / 86400)::int end
    )
  ) into v_resultado;

  -- falhas operacionais: o que merece olhar, num lugar só
  v_resultado := v_resultado || jsonb_build_object('falhas', jsonb_build_object(
    'vendas_canceladas', v_resultado #> '{vendas,canceladas}',
    'estornos', v_resultado #> '{vendas,estornos}',
    'caixas_com_diferenca', v_resultado #> '{caixa,com_diferenca}',
    'atendimentos_presos', v_resultado #> '{atendimentos,em_andamento_24h}',
    'agendamentos_sem_fechamento', v_resultado #> '{agendamentos,passados_sem_fechamento}',
    'estoque_negativo', v_resultado #> '{estoque,negativos}',
    'push_falhas', v_resultado #> '{incidentes,push_falhas}',
    'jobs_com_falha', v_resultado #> '{incidentes,jobs_com_falha}'
  ));
  return v_resultado;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Coleta (só escreve nas tabelas do piloto)
-- ---------------------------------------------------------------------------
create or replace function public.piloto_hoje()
returns date
language sql
stable
as $function$
  select (now() at time zone 'America/Sao_Paulo')::date;
$function$;

-- Grava (ou atualiza, se ainda aberto) o retrato de um dia. Retrato
-- fechado não muda mais.
create or replace function public.piloto_gravar_snapshot(p_piloto uuid, p_dia date, p_final boolean)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v public.piloto%rowtype;
  v_metricas jsonb;
  v_n int;
begin
  select * into v from public.piloto where id = p_piloto;
  if not found or p_dia < v.inicio - 1 or p_dia > v.fim then
    return false;
  end if;
  v_metricas := public.piloto_metricas(v.company_id, p_dia);
  insert into public.piloto_snapshot as s (piloto_id, dia, dia_do_piloto, final, atrasado, versao, capturado_em, metricas)
  values (p_piloto, p_dia, p_dia - v.inicio + 1, p_final, p_final and p_dia < public.piloto_hoje() - 1, 1, now(), v_metricas)
  on conflict (piloto_id, dia) do update
    set final = excluded.final, atrasado = excluded.atrasado, versao = excluded.versao,
        capturado_em = excluded.capturado_em, metricas = excluded.metricas
    where s.final = false;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$function$;

-- Sessões ativas na última hora (mais folga) → piloto_atividade.
create or replace function public.piloto_registrar_atividade(p_piloto uuid)
returns int
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid;
  v_n int;
begin
  select company_id into v_company from public.piloto where id = p_piloto;
  if v_company is null then
    return 0;
  end if;
  insert into public.piloto_atividade (piloto_id, user_id, hora)
  select distinct p_piloto, x.user_id, date_trunc('hour', x.ts)
    from (
      select s.user_id, greatest(s.updated_at, coalesce(s.refreshed_at at time zone 'UTC', s.created_at), s.created_at) as ts
        from auth.sessions s
       where s.user_id in (select pu.user_id from public.piloto_usuarios(v_company) pu)
      union all
      select au.id, au.last_sign_in_at from auth.users au
       where au.id in (select pu.user_id from public.piloto_usuarios(v_company) pu) and au.last_sign_in_at is not null
    ) x
   where x.ts > now() - interval '70 minutes' and x.ts <= now()
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

-- Status pela data: planejado → ativo no início; → encerrado depois do fim
-- (só quando o último dia já está fechado).
create or replace function public.piloto_atualizar_status()
returns int
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_hoje date := public.piloto_hoje();
  v_n int := 0;
  v_m int;
begin
  update public.piloto set status = 'ativo'
   where status = 'planejado' and v_hoje between inicio and fim;
  get diagnostics v_m = row_count;
  v_n := v_n + v_m;
  update public.piloto p set status = 'encerrado', encerrado_em = now(), motivo_encerramento = coalesce(p.motivo_encerramento, 'Fim do período')
   where p.status in ('planejado', 'ativo') and v_hoje > p.fim
     and exists (select 1 from public.piloto_snapshot s where s.piloto_id = p.id and s.dia = p.fim and s.final);
  get diagnostics v_m = row_count;
  return v_n + v_m;
end;
$function$;

-- Job horário: atividade + retrato parcial de hoje.
create or replace function public.piloto_coletar()
returns int
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_hoje date := public.piloto_hoje();
  v_p record;
  v_n int := 0;
begin
  perform public.piloto_atualizar_status();
  for v_p in select id from public.piloto where status in ('planejado', 'ativo') and v_hoje between inicio - 1 and fim loop
    begin
      perform public.piloto_registrar_atividade(v_p.id);
      if public.piloto_gravar_snapshot(v_p.id, v_hoje, false) then
        v_n := v_n + 1;
      end if;
    exception when others then
      raise warning 'coleta do piloto % falhou: %', v_p.id, sqlerrm;
    end;
  end loop;
  return v_n;
end;
$function$;

-- Job diário (00:10 em São Paulo): fecha os dias que passaram (inclusive
-- os que ficaram para trás se algum fechamento falhou) e atualiza status.
create or replace function public.piloto_fechar_dias()
returns int
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_hoje date := public.piloto_hoje();
  v_p record;
  v_dia date;
  v_n int := 0;
begin
  for v_p in select id, inicio, fim from public.piloto where status in ('planejado', 'ativo') and v_hoje >= inicio loop
    begin
      for v_dia in select d::date from generate_series(v_p.inicio - 1, least(v_hoje - 1, v_p.fim), interval '1 day') d loop
        if not exists (select 1 from public.piloto_snapshot s where s.piloto_id = v_p.id and s.dia = v_dia and s.final) then
          if public.piloto_gravar_snapshot(v_p.id, v_dia, true) then
            v_n := v_n + 1;
          end if;
        end if;
      end loop;
    exception when others then
      raise warning 'fechamento do piloto % falhou: %', v_p.id, sqlerrm;
    end;
  end loop;
  perform public.piloto_atualizar_status();
  return v_n;
end;
$function$;

revoke all on function public.uso_por_modulo(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.piloto_usuarios(uuid) from public, anon, authenticated;
revoke all on function public.piloto_metricas(uuid, date) from public, anon, authenticated;
revoke all on function public.piloto_hoje() from public, anon, authenticated;
revoke all on function public.piloto_gravar_snapshot(uuid, date, boolean) from public, anon, authenticated;
revoke all on function public.piloto_registrar_atividade(uuid) from public, anon, authenticated;
revoke all on function public.piloto_atualizar_status() from public, anon, authenticated;
revoke all on function public.piloto_coletar() from public, anon, authenticated;
revoke all on function public.piloto_fechar_dias() from public, anon, authenticated;

select cron.schedule('plataforma-piloto-coleta', '5 * * * *', $$select public.piloto_coletar()$$);
-- 03:10 UTC = 00:10 em São Paulo (sem horário de verão desde 2019)
select cron.schedule('plataforma-piloto-fechamento', '10 3 * * *', $$select public.piloto_fechar_dias()$$);

-- ---------------------------------------------------------------------------
-- 5. Admin (platform_admin ativo; escritas auditadas)
-- ---------------------------------------------------------------------------
create or replace function public.admin_criar_piloto(
  p_company uuid, p_nome text, p_inicio date, p_dias int default 14, p_objetivo text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid;
  v_fim date;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.company where id = p_company) then
    raise exception 'EMPRESA_NAO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if p_dias is null or p_dias not between 1 and 90 then
    raise exception 'DURACAO_INVALIDA' using errcode = '22023';
  end if;
  if p_inicio is null or p_inicio < public.piloto_hoje() or p_inicio > public.piloto_hoje() + 60 then
    raise exception 'INICIO_INVALIDO' using errcode = '22023';
  end if;
  if exists (select 1 from public.piloto where company_id = p_company and status in ('planejado', 'ativo')) then
    raise exception 'PILOTO_JA_ABERTO' using errcode = '23505';
  end if;
  v_fim := p_inicio + p_dias - 1;

  insert into public.piloto (company_id, nome, objetivo, inicio, fim, status, criado_por)
  values (p_company, btrim(p_nome), nullif(btrim(p_objetivo), ''), p_inicio, v_fim,
          case when public.piloto_hoje() >= p_inicio then 'ativo' else 'planejado' end, auth.uid())
  returning id into v_id;

  perform public.write_platform_audit_log('pilot_created', 'piloto', v_id, null,
    jsonb_build_object('company_id', p_company, 'nome', btrim(p_nome), 'inicio', p_inicio, 'fim', v_fim), null);

  -- Dia 0 (véspera do início) já nasce registrado quando é hoje; depois a
  -- coleta horária o mantém até o fechamento.
  if public.piloto_hoje() = p_inicio - 1 then
    perform public.piloto_gravar_snapshot(v_id, p_inicio - 1, false);
    perform public.piloto_registrar_atividade(v_id);
  end if;
  return v_id;
end;
$function$;

create or replace function public.admin_encerrar_piloto(p_id uuid, p_motivo text, p_cancelar boolean default false)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v public.piloto%rowtype;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into v from public.piloto where id = p_id for update;
  if not found or v.status not in ('planejado', 'ativo') then
    raise exception 'PILOTO_NAO_ABERTO' using errcode = 'P0002';
  end if;
  if p_motivo is null or length(btrim(p_motivo)) < 3 then
    raise exception 'MOTIVO_OBRIGATORIO' using errcode = '22023';
  end if;
  -- fecha o retrato de hoje com o que houver até agora
  if public.piloto_hoje() between v.inicio - 1 and v.fim then
    perform public.piloto_gravar_snapshot(p_id, public.piloto_hoje(), true);
  end if;
  update public.piloto
     set status = case when p_cancelar then 'cancelado' else 'encerrado' end,
         encerrado_em = now(), encerrado_por = auth.uid(), motivo_encerramento = left(btrim(p_motivo), 300)
   where id = p_id;
  perform public.write_platform_audit_log(case when p_cancelar then 'pilot_cancelled' else 'pilot_closed' end, 'piloto', p_id,
    jsonb_build_object('status', v.status), jsonb_build_object('status', case when p_cancelar then 'cancelado' else 'encerrado' end), left(btrim(p_motivo), 300));
end;
$function$;

-- Atualiza agora o retrato parcial de hoje (mesma coleta do job).
create or replace function public.admin_capturar_piloto(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v public.piloto%rowtype;
  v_ok boolean := false;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into v from public.piloto where id = p_id;
  if not found or v.status not in ('planejado', 'ativo') then
    raise exception 'PILOTO_NAO_ABERTO' using errcode = 'P0002';
  end if;
  if public.piloto_hoje() between v.inicio - 1 and v.fim then
    perform public.piloto_registrar_atividade(p_id);
    v_ok := public.piloto_gravar_snapshot(p_id, public.piloto_hoje(), false);
  end if;
  perform public.write_platform_audit_log('pilot_snapshot_refreshed', 'piloto', p_id, null, jsonb_build_object('dia', public.piloto_hoje()), null);
  return v_ok;
end;
$function$;

create or replace function public.admin_listar_pilotos()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'nome', p.nome, 'status', p.status, 'inicio', p.inicio, 'fim', p.fim,
             'company_id', p.company_id, 'empresa', btrim(c.name), 'criado_em', p.criado_em,
             'hoje', public.piloto_hoje(),
             'ultimo', (select jsonb_build_object('dia', s.dia, 'dia_do_piloto', s.dia_do_piloto, 'final', s.final, 'capturado_em', s.capturado_em,
                                                  'usuarios_ativos', s.metricas #> '{usuarios,ativos}', 'ultimo_acesso', s.metricas #> '{usuarios,ultimo_acesso}',
                                                  'operacoes', s.metricas -> 'operacoes', 'valor', s.metricas #> '{vendas,valor}')
                          from public.piloto_snapshot s where s.piloto_id = p.id order by s.dia desc limit 1),
             'dias_registrados', (select count(*) from public.piloto_snapshot s where s.piloto_id = p.id))
           order by case p.status when 'ativo' then 0 when 'planejado' then 1 else 2 end, p.inicio desc)
      from public.piloto p join public.company c on c.id = p.company_id), '[]'::jsonb);
end;
$function$;

create or replace function public.admin_piloto_detalhe(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v public.piloto%rowtype;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into v from public.piloto where id = p_id;
  if not found then
    raise exception 'PILOTO_NAO_ENCONTRADO' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'piloto', to_jsonb(v) || jsonb_build_object('empresa', (select btrim(c.name) from public.company c where c.id = v.company_id),
                                               'slug', (select c.slug from public.company c where c.id = v.company_id)),
    'hoje', public.piloto_hoje(),
    'snapshots', coalesce((select jsonb_agg(jsonb_build_object('dia', s.dia, 'dia_do_piloto', s.dia_do_piloto, 'final', s.final,
                                                              'atrasado', s.atrasado, 'capturado_em', s.capturado_em, 'metricas', s.metricas)
                                            order by s.dia)
                             from public.piloto_snapshot s where s.piloto_id = p_id), '[]'::jsonb),
    -- quem é quem (e-mail só aqui, lido na hora; o retrato guarda só ids)
    'usuarios', coalesce((select jsonb_agg(jsonb_build_object('user_id', pu.user_id, 'email', au.email, 'papel', pu.papel,
                                                             'profissional', pu.profissional, 'ultimo_acesso', au.last_sign_in_at)
                                           order by pu.papel, au.email)
                            from public.piloto_usuarios(v.company_id) pu join auth.users au on au.id = pu.user_id), '[]'::jsonb),
    -- mapa dia da semana × hora das sessões no período (São Paulo)
    'mapa_sessoes', coalesce((select jsonb_agg(jsonb_build_object('dow', x.dow, 'hora', x.hh, 'usuarios', x.n))
                                from (select extract(isodow from pa.hora at time zone 'America/Sao_Paulo')::int as dow,
                                             extract(hour from pa.hora at time zone 'America/Sao_Paulo')::int as hh,
                                             count(distinct pa.user_id || ':' || ((pa.hora at time zone 'America/Sao_Paulo')::date)) as n
                                        from public.piloto_atividade pa where pa.piloto_id = p_id group by 1, 2) x), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.admin_criar_piloto(uuid, text, date, int, text) from public, anon;
revoke all on function public.admin_encerrar_piloto(uuid, text, boolean) from public, anon;
revoke all on function public.admin_capturar_piloto(uuid) from public, anon;
revoke all on function public.admin_listar_pilotos() from public, anon;
revoke all on function public.admin_piloto_detalhe(uuid) from public, anon;
grant execute on function public.admin_criar_piloto(uuid, text, date, int, text) to authenticated;
grant execute on function public.admin_encerrar_piloto(uuid, text, boolean) to authenticated;
grant execute on function public.admin_capturar_piloto(uuid) to authenticated;
grant execute on function public.admin_listar_pilotos() to authenticated;
grant execute on function public.admin_piloto_detalhe(uuid) to authenticated;
