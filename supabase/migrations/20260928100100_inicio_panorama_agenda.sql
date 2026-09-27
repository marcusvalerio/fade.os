-- Panorama do Início: minutos AGENDADOS por profissional no período.
--
-- A ocupação por cronômetro (started_at/ended_at dos itens) quase nunca é
-- preenchida na operação real — a barbearia fecha o atendimento sem usar
-- o cronômetro —, então "minutos atendidos ÷ capacidade" mostrava 0% para
-- todo mundo. A agenda é a fonte honesta de ocupação: soma a duração das
-- linhas de agendamento do profissional no período, fora cancelados e
-- "não compareceu". Mesma função, mesmas permissões (SECURITY INVOKER).

create or replace function public.get_inicio_panorama(p_company_id uuid, p_start date, p_end date)
returns jsonb
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
set "TimeZone" to 'America/Sao_Paulo'
as $function$
  with
  vendas as (
    select s.* from public.sale s
    where s.company_id = p_company_id and s.status = 'completed'
      and s.created_at::date between p_start and p_end
  ),
  itens as (
    select si.* from public.sale_item si join vendas v on v.id = si.sale_id
  ),
  mes as (
    select coalesce(sum(total), 0) as total
    from public.sale
    where company_id = p_company_id and status = 'completed'
      and date_trunc('month', created_at) = date_trunc('month', now())
  ),
  atend_itens as (
    select ai.*, a.client_id, a.id as att_id
    from public.attendance_item ai
    join public.attendance a on a.id = ai.attendance_id
    where a.company_id = p_company_id and a.status = 'completed'
      and a.created_at::date between p_start and p_end
  ),
  jornada as (
    select ps.professional_id, ps.weekday,
      extract(epoch from (ps.end_time - ps.start_time)) / 60
        - coalesce((
            select sum(extract(epoch from (b.end_time - b.start_time)) / 60)
            from public.professional_schedule_break b where b.schedule_id = ps.id
          ), 0) as minutos
    from public.professional_schedule ps
    join public.professional pr on pr.id = ps.professional_id
    where pr.company_id = p_company_id and ps.active
  ),
  dias as (select generate_series(p_start, p_end, interval '1 day')::date as dia),
  capacidade as (
    select j.professional_id, sum(j.minutos) as minutos
    from dias d join jornada j on j.weekday = extract(dow from d.dia)
    group by j.professional_id
  ),
  equipe as (
    select
      p.id,
      p.name,
      count(distinct ai.att_id) filter (where ai.service_id is not null)::int as atendimentos,
      coalesce(sum(ai.final_price), 0) as receita,
      coalesce(sum(extract(epoch from (ai.ended_at - ai.started_at)) / 60)
        filter (where ai.started_at is not null and ai.ended_at is not null), 0) as minutos_atendidos,
      coalesce((
        select sum(c.amount) from public.commission c
        where c.professional_id = p.id and c.status in ('due', 'paid')
          and c.created_at::date between p_start and p_end
      ), 0) as comissao,
      coalesce((select minutos from capacidade cp where cp.professional_id = p.id), 0) as capacidade_minutos,
      coalesce((
        select sum(extract(epoch from (s.ends_at - s.starts_at)) / 60)
        from public.appointment_service s
        join public.appointment a on a.id = s.appointment_id
        where s.professional_id = p.id
          and a.status not in ('cancelled_by_client', 'cancelled_by_company', 'no_show')
          and s.starts_at::date between p_start and p_end
      ), 0) as minutos_agendados
    from public.professional p
    left join atend_itens ai on ai.professional_id = p.id
    where p.company_id = p_company_id and p.active
    group by p.id, p.name
  ),
  produtos as (
    select * from public.product where company_id = p_company_id and active
  ),
  saida as (
    select si.product_id, sum(si.quantity) as quantidade, sum(si.total) as receita
    from itens si where si.kind = 'product' and si.product_id is not null
    group by si.product_id
  ),
  parados as (
    select p.* from produtos p
    where p.current_stock > 0
      and p.created_at < now() - interval '60 days'
      and not exists (
        select 1 from public.stock_movement m
        where m.product_id = p.id and m.movement_type = 'sale'
          and m.created_at >= now() - interval '60 days'
      )
  ),
  agendamentos as (
    select a.id, a.status
    from public.appointment a
    join public.appointment_service s on s.appointment_id = a.id
    where a.company_id = p_company_id
    group by a.id, a.status
    having min(s.starts_at)::date between p_start and p_end
  )
  select jsonb_build_object(
    'vendas', jsonb_build_object(
      'servicos', coalesce((select sum(total) from itens where kind = 'service'), 0),
      'produtos', coalesce((select sum(total) from itens where kind = 'product'), 0),
      'quantidade', (select count(*) from vendas),
      'avulsas', (select count(*) from vendas where attendance_id is null)
    ),
    'mes', jsonb_build_object('faturamento', (select total from mes)),
    'equipe', coalesce((select jsonb_agg(to_jsonb(e) order by e.name) from equipe e), '[]'::jsonb),
    'clientes', jsonb_build_object(
      'cadastrados', (select count(*) from public.client where company_id = p_company_id),
      'ativos_90d', (
        select count(distinct client_id) from public.attendance
        where company_id = p_company_id and status = 'completed' and client_id is not null
          and created_at >= now() - interval '90 days'
      ),
      'atendidos', (select count(distinct client_id) from atend_itens where client_id is not null),
      'gasto_medio', coalesce((
        select round(avg(t), 2) from (
          select sum(final_price) as t from atend_itens where client_id is not null group by client_id
        ) x
      ), 0)
    ),
    'estoque', jsonb_build_object(
      'valor_custo',
        coalesce((select sum(coalesce(cost_price, 0) * greatest(current_stock, 0)) from produtos), 0)
        + coalesce((
            select sum(coalesce(cost_price, 0) * greatest(current_stock, 0))
            from public.consumable where company_id = p_company_id and active
          ), 0),
      'valor_venda', coalesce((select sum(coalesce(sale_price, 0) * greatest(current_stock, 0)) from produtos), 0),
      'produtos_ativos', (select count(*) from produtos),
      'criticos', coalesce((
        select jsonb_agg(jsonb_build_object('id', id, 'nome', name, 'atual', current_stock, 'minimo', minimum_stock)
                         order by current_stock - minimum_stock)
        from (select * from produtos where current_stock <= minimum_stock order by current_stock - minimum_stock limit 8) x
      ), '[]'::jsonb),
      'criticos_total', (select count(*) from produtos where current_stock <= minimum_stock),
      'maior_saida', coalesce((
        select jsonb_agg(jsonb_build_object('nome', p.name, 'quantidade', s.quantidade, 'receita', s.receita)
                         order by s.quantidade desc)
        from (select * from saida order by quantidade desc limit 5) s
        join public.product p on p.id = s.product_id
      ), '[]'::jsonb),
      'parados', coalesce((
        select jsonb_agg(jsonb_build_object('nome', name, 'atual', current_stock) order by name)
        from (select * from parados order by name limit 6) x
      ), '[]'::jsonb),
      'parados_total', (select count(*) from parados)
    ),
    'agenda', jsonb_build_object(
      'total', (select count(*) from agendamentos),
      'concluidos', (select count(*) from agendamentos where status = 'completed'),
      'cancelados', (select count(*) from agendamentos where status in ('cancelled_by_client', 'cancelled_by_company')),
      'nao_compareceu', (select count(*) from agendamentos where status = 'no_show')
    )
  );
$function$;

