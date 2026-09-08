-- FADE OS — dados para o Início redesenhado.
--
-- O Dashboard mostrava treze cards iguais porque só existia
-- `get_dashboard_metrics`, que devolve agregados do período inteiro. Uma
-- página que responde "como está evoluindo?" precisa de série temporal, e uma
-- que responde "quem está performando?" precisa de recorte por serviço e por
-- profissional.
--
-- Nada é recalculado de forma diferente: as definições abaixo são as MESMAS de
-- get_dashboard_metrics — faturamento é `sum(sale.total)` de venda concluída,
-- atendimento é `attendance` concluído, cliente novo é o primeiro atendimento
-- concluído da pessoa. Só muda a granularidade.
--
-- SECURITY INVOKER, como a função de métricas: o RLS de sale/attendance/
-- attendance_item continua sendo quem decide o que cada usuário enxerga.

-- ---------------------------------------------------------------------------
-- Série diária
-- ---------------------------------------------------------------------------
create or replace function public.get_dashboard_series(
  p_company_id uuid,
  p_unit_id uuid default null,
  p_start date default current_date,
  p_end date default current_date
)
returns table (
  dia date,
  faturamento numeric,
  atendimentos integer,
  clientes_novos integer
)
language sql
stable
set search_path = public, pg_temp
as $$
  with escopo_unit as (
    select id from public.unit
    where company_id = p_company_id and (p_unit_id is null or id = p_unit_id)
  ),
  dias as (
    select generate_series(p_start, p_end, interval '1 day')::date as dia
  ),
  vendas as (
    select created_at::date as dia, sum(total) as total
    from public.sale
    where company_id = p_company_id
      and unit_id in (select id from escopo_unit)
      and status = 'completed'
      and created_at::date between p_start and p_end
    group by 1
  ),
  atend as (
    select created_at::date as dia, count(*) as total
    from public.attendance
    where company_id = p_company_id
      and unit_id in (select id from escopo_unit)
      and status = 'completed'
      and created_at::date between p_start and p_end
    group by 1
  ),
  primeiro as (
    select client_id, min(created_at::date) as primeira_data
    from public.attendance
    where company_id = p_company_id and status = 'completed'
    group by client_id
  ),
  novos as (
    select primeira_data as dia, count(*) as total
    from primeiro
    where primeira_data between p_start and p_end
    group by 1
  )
  select
    d.dia,
    coalesce(v.total, 0)::numeric,
    coalesce(a.total, 0)::integer,
    coalesce(n.total, 0)::integer
  from dias d
  left join vendas v on v.dia = d.dia
  left join atend a on a.dia = d.dia
  left join novos n on n.dia = d.dia
  order by d.dia;
$$;

revoke all on function public.get_dashboard_series(uuid, uuid, date, date) from public, anon;
grant execute on function public.get_dashboard_series(uuid, uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Recortes: serviços mais realizados e desempenho da equipe
-- ---------------------------------------------------------------------------
-- Um jsonb só, para a página não pagar duas idas ao banco por uma informação
-- que sempre aparece junta.
create or replace function public.get_dashboard_breakdown(
  p_company_id uuid,
  p_unit_id uuid default null,
  p_start date default current_date,
  p_end date default current_date
)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  with escopo_unit as (
    select id from public.unit
    where company_id = p_company_id and (p_unit_id is null or id = p_unit_id)
  ),
  itens as (
    select ai.*
    from public.attendance_item ai
    join public.attendance a on a.id = ai.attendance_id
    where a.company_id = p_company_id
      and a.unit_id in (select id from escopo_unit)
      and a.status = 'completed'
      and a.created_at::date between p_start and p_end
  ),
  servicos as (
    select s.name, count(*)::int as quantidade, sum(i.final_price)::numeric as receita
    from itens i
    join public.service s on s.id = i.service_id
    where i.service_id is not null
    group by s.name
    order by count(*) desc, sum(i.final_price) desc
    limit 6
  ),
  equipe as (
    select
      p.name,
      count(*) filter (where i.service_id is not null)::int as atendimentos,
      sum(i.final_price)::numeric as receita
    from itens i
    join public.professional p on p.id = i.professional_id
    where i.professional_id is not null
    group by p.name
    order by sum(i.final_price) desc
    limit 6
  )
  select jsonb_build_object(
    'servicos', coalesce((select jsonb_agg(to_jsonb(s)) from servicos s), '[]'::jsonb),
    'equipe', coalesce((select jsonb_agg(to_jsonb(e)) from equipe e), '[]'::jsonb)
  );
$$;

revoke all on function public.get_dashboard_breakdown(uuid, uuid, date, date) from public, anon;
grant execute on function public.get_dashboard_breakdown(uuid, uuid, date, date) to authenticated;
