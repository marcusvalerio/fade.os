-- FADE OS — Fase 4, parte B — funções de orquestração atômica + consolidação.
--
-- Todas SECURITY INVOKER: rodam com o privilégio de quem chama (sempre um
-- usuário autenticado da própria empresa), RLS continua sendo a barreira
-- real — igual ao desenho de get_available_slots na Fase 2. A única razão
-- para existirem como função de banco (em vez de vários requests do
-- Supabase-js) é atomicidade: fechar um atendimento precisa criar
-- venda+itens+pagamentos+comissão+baixa de estoque+lançamento financeiro
-- juntos, ou nada — não dá pra garantir isso com múltiplas chamadas
-- PostgREST separadas.

-- =============================================================================
-- Auditoria — helper único, reaproveitado por todas as ações sensíveis.
-- =============================================================================
create or replace function public.write_audit_log(
  p_company_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.audit_log (company_id, user_id, action, entity_type, entity_id, before, after, reason)
  values (p_company_id, auth.uid(), p_action, p_entity_type, p_entity_id, p_before, p_after, p_reason)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.write_audit_log(uuid, text, text, uuid, jsonb, jsonb, text) from public;
grant execute on function public.write_audit_log(uuid, text, text, uuid, jsonb, jsonb, text) to authenticated;

-- =============================================================================
-- Fechamento de atendimento → venda + itens + comissão + baixa de estoque +
-- pagamentos + movimentação de caixa + lançamento financeiro.
-- =============================================================================
create or replace function public.close_attendance(
  p_attendance_id uuid,
  p_discount_amount numeric default 0,
  p_surcharge_amount numeric default 0,
  p_payments jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_attendance public.attendance;
  v_subtotal numeric := 0;
  v_total numeric;
  v_sale_id uuid;
  v_item record;
  v_alloc_ratio numeric;
  v_item_total numeric;
  v_sale_item_id uuid;
  v_commission_percent numeric;
  v_commission_amount numeric;
  v_cash_session_id uuid;
  v_payment jsonb;
  v_payment_sum numeric := 0;
  v_item_count int;
begin
  select * into v_attendance from public.attendance where id = p_attendance_id;
  if v_attendance.id is null then
    raise exception 'ATENDIMENTO_NAO_ENCONTRADO' using errcode = 'P0002';
  end if;
  if v_attendance.status <> 'in_progress' then
    raise exception 'ATENDIMENTO_JA_FECHADO' using errcode = '22023';
  end if;

  select count(*) into v_item_count from public.attendance_item where attendance_id = p_attendance_id;
  if v_item_count = 0 then
    raise exception 'ATENDIMENTO_SEM_ITENS' using errcode = '22023';
  end if;

  if p_discount_amount < 0 or p_surcharge_amount < 0 then
    raise exception 'VALOR_INVALIDO' using errcode = '22023';
  end if;

  select coalesce(sum(final_price), 0) into v_subtotal from public.attendance_item where attendance_id = p_attendance_id;

  if p_discount_amount > v_subtotal then
    raise exception 'DESCONTO_MAIOR_QUE_SUBTOTAL' using errcode = '22023';
  end if;

  v_total := v_subtotal - p_discount_amount + p_surcharge_amount;

  select coalesce(sum((p->>'amount')::numeric), 0) into v_payment_sum
  from jsonb_array_elements(p_payments) p;

  if p_payments <> '[]'::jsonb and abs(v_payment_sum - v_total) > 0.01 then
    raise exception 'PAGAMENTO_NAO_CONFERE' using errcode = '22023';
  end if;

  insert into public.sale (company_id, unit_id, client_id, attendance_id, status, subtotal, discount_amount, surcharge_amount, total, created_by)
  values (v_attendance.company_id, v_attendance.unit_id, v_attendance.client_id, p_attendance_id, 'completed', v_subtotal, p_discount_amount, p_surcharge_amount, v_total, auth.uid())
  returning id into v_sale_id;

  for v_item in select * from public.attendance_item where attendance_id = p_attendance_id loop
    v_alloc_ratio := case when v_subtotal > 0 then v_item.final_price / v_subtotal else 0 end;
    v_item_total := round(v_item.final_price - (p_discount_amount * v_alloc_ratio) + (p_surcharge_amount * v_alloc_ratio), 2);

    insert into public.sale_item (
      sale_id, company_id, kind, service_id, product_id, attendance_item_id, professional_id,
      quantity, unit_price, discount, is_courtesy, total
    )
    values (
      v_sale_id, v_attendance.company_id, v_item.kind, v_item.service_id, v_item.product_id, v_item.id, v_item.professional_id,
      coalesce(v_item.quantity, 1), v_item.original_price, v_item.discount, v_item.type = 'courtesy', v_item_total
    )
    returning id into v_sale_item_id;

    if v_item.kind = 'service' and v_item.professional_id is not null then
      select coalesce(
        (select default_commission_percent from public.service where id = v_item.service_id),
        (select default_commission_percent from public.professional where id = v_item.professional_id),
        0
      ) into v_commission_percent;

      v_commission_amount := round(v_item_total * v_commission_percent / 100, 2);

      insert into public.commission (company_id, sale_item_id, professional_id, base_amount, percent, amount, status)
      values (v_attendance.company_id, v_sale_item_id, v_item.professional_id, v_item_total, v_commission_percent, v_commission_amount, 'due');

      update public.attendance_item
        set commission_percent_snapshot = v_commission_percent, commission_amount = v_commission_amount
        where id = v_item.id;
    end if;

    if v_item.kind = 'product' and v_item.product_id is not null then
      insert into public.stock_movement (company_id, unit_id, item_type, product_id, movement_type, quantity, reference_type, reference_id, created_by)
      values (v_attendance.company_id, v_attendance.unit_id, 'product', v_item.product_id, 'sale', -coalesce(v_item.quantity, 1), 'sale_item', v_sale_item_id, auth.uid());

      update public.product set current_stock = current_stock - coalesce(v_item.quantity, 1) where id = v_item.product_id;
    end if;
  end loop;

  select cs.id into v_cash_session_id
    from public.cash_session cs
    join public.cash_register cr on cr.id = cs.cash_register_id
    where cr.unit_id = v_attendance.unit_id and cs.status = 'open'
    order by cs.opened_at desc
    limit 1;

  for v_payment in select * from jsonb_array_elements(p_payments) loop
    declare
      v_method text := v_payment->>'method';
      v_amount numeric := (v_payment->>'amount')::numeric;
      v_payment_id uuid;
    begin
      if v_amount <= 0 then
        raise exception 'VALOR_PAGAMENTO_INVALIDO' using errcode = '22023';
      end if;

      if not exists (
        select 1 from public.payment_method pm
        where pm.company_id = v_attendance.company_id and pm.method = v_method and pm.active
      ) then
        raise exception 'METODO_PAGAMENTO_INVALIDO' using errcode = '22023';
      end if;

      insert into public.payment (company_id, sale_id, method, amount, status, cash_session_id, created_by)
      values (v_attendance.company_id, v_sale_id, v_method, v_amount, 'confirmed', v_cash_session_id, auth.uid())
      returning id into v_payment_id;

      if v_cash_session_id is not null and v_method = 'cash' then
        insert into public.cash_movement (company_id, cash_session_id, type, amount, method, reference_type, reference_id, created_by)
        values (v_attendance.company_id, v_cash_session_id, 'sale_payment', v_amount, v_method, 'payment', v_payment_id, auth.uid());
      end if;

      insert into public.financial_entry (company_id, unit_id, type, category, description, amount, reference_type, reference_id, entry_date, created_by)
      values (v_attendance.company_id, v_attendance.unit_id, 'income', 'venda', 'Pagamento de venda', v_amount, 'payment', v_payment_id, current_date, auth.uid());
    end;
  end loop;

  update public.attendance set status = 'completed', updated_at = now() where id = p_attendance_id;

  perform public.write_audit_log(v_attendance.company_id, 'close_attendance', 'sale', v_sale_id, null,
    jsonb_build_object('total', v_total, 'discount_amount', p_discount_amount, 'surcharge_amount', p_surcharge_amount));

  return v_sale_id;
end;
$$;

revoke all on function public.close_attendance(uuid, numeric, numeric, jsonb) from public;
grant execute on function public.close_attendance(uuid, numeric, numeric, jsonb) to authenticated;

-- =============================================================================
-- Cancelamento/estorno de venda — nunca apaga histórico, sempre lança
-- estornos compensatórios (financial_entry/cash_movement) e reverte
-- comissão + estoque.
-- =============================================================================
create or replace function public.cancel_sale(p_sale_id uuid, p_reason text)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_sale public.sale;
  v_item record;
  v_payment record;
begin
  select * into v_sale from public.sale where id = p_sale_id;
  if v_sale.id is null then
    raise exception 'VENDA_NAO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if v_sale.status = 'cancelled' then
    raise exception 'VENDA_JA_CANCELADA' using errcode = '22023';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'MOTIVO_OBRIGATORIO' using errcode = '22023';
  end if;

  for v_item in select * from public.sale_item where sale_id = p_sale_id loop
    if v_item.kind = 'product' and v_item.product_id is not null then
      insert into public.stock_movement (company_id, unit_id, item_type, product_id, movement_type, quantity, reference_type, reference_id, reason, created_by)
      values (v_sale.company_id, v_sale.unit_id, 'product', v_item.product_id, 'adjustment', v_item.quantity, 'sale_cancel', p_sale_id, 'Estorno de venda cancelada', auth.uid());

      update public.product set current_stock = current_stock + v_item.quantity where id = v_item.product_id;
    end if;

    update public.commission
      set status = 'reversed', reversed_at = now(), reversed_reason = p_reason
      where sale_item_id = v_item.id and status in ('predicted', 'due');
  end loop;

  for v_payment in select * from public.payment where sale_id = p_sale_id and status = 'confirmed' loop
    update public.payment
      set status = 'refunded', refunded_at = now(), refunded_reason = p_reason, refunded_by = auth.uid()
      where id = v_payment.id;

    if v_payment.cash_session_id is not null and v_payment.method = 'cash' then
      insert into public.cash_movement (company_id, cash_session_id, type, amount, method, reference_type, reference_id, reason, created_by)
      values (v_sale.company_id, v_payment.cash_session_id, 'other_out', v_payment.amount, v_payment.method, 'payment_refund', v_payment.id, p_reason, auth.uid());
    end if;

    insert into public.financial_entry (company_id, unit_id, type, category, description, amount, reference_type, reference_id, entry_date, created_by)
    values (v_sale.company_id, v_sale.unit_id, 'expense', 'estorno', 'Estorno de pagamento', v_payment.amount, 'payment_refund', v_payment.id, current_date, auth.uid());
  end loop;

  update public.sale
    set status = 'cancelled', cancelled_at = now(), cancelled_reason = p_reason, cancelled_by = auth.uid(), updated_at = now()
    where id = p_sale_id;

  if v_sale.attendance_id is not null then
    update public.attendance set status = 'cancelled', updated_at = now() where id = v_sale.attendance_id and status = 'completed';
  end if;

  perform public.write_audit_log(v_sale.company_id, 'cancel_sale', 'sale', p_sale_id,
    jsonb_build_object('status', v_sale.status), jsonb_build_object('status', 'cancelled'), p_reason);
end;
$$;

revoke all on function public.cancel_sale(uuid, text) from public;
grant execute on function public.cancel_sale(uuid, text) to authenticated;

-- =============================================================================
-- Ajuste manual de estoque (entrada/ajuste/perda/inventário/consumo) —
-- move a linha de estoque e atualiza current_stock atomicamente.
-- =============================================================================
create or replace function public.adjust_stock(
  p_company_id uuid,
  p_unit_id uuid,
  p_item_type text,
  p_item_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_unit_cost numeric default null,
  p_reason text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_movement_id uuid;
  v_signed_quantity numeric;
begin
  if p_item_type not in ('product', 'consumable') then
    raise exception 'TIPO_INVALIDO' using errcode = '22023';
  end if;
  if p_movement_type not in ('entry', 'consumption', 'adjustment', 'loss', 'inventory') then
    raise exception 'MOVIMENTO_INVALIDO' using errcode = '22023';
  end if;
  if p_quantity = 0 then
    raise exception 'QUANTIDADE_INVALIDA' using errcode = '22023';
  end if;

  -- entrada sempre soma; consumo/perda sempre subtraem (quantidade
  -- informada é sempre positiva no formulário); ajuste/inventário usam o
  -- sinal exatamente como informado (permite corrigir pra cima ou pra
  -- baixo).
  v_signed_quantity := case
    when p_movement_type = 'entry' then abs(p_quantity)
    when p_movement_type in ('consumption', 'loss') then -abs(p_quantity)
    else p_quantity
  end;

  insert into public.stock_movement (company_id, unit_id, item_type, product_id, consumable_id, movement_type, quantity, unit_cost, reason, created_by)
  values (
    p_company_id, p_unit_id, p_item_type,
    case when p_item_type = 'product' then p_item_id end,
    case when p_item_type = 'consumable' then p_item_id end,
    p_movement_type, v_signed_quantity, p_unit_cost, p_reason, auth.uid()
  )
  returning id into v_movement_id;

  if p_item_type = 'product' then
    update public.product set current_stock = current_stock + v_signed_quantity where id = p_item_id;
  else
    update public.consumable set current_stock = current_stock + v_signed_quantity where id = p_item_id;
  end if;

  if p_movement_type in ('adjustment', 'loss') then
    perform public.write_audit_log(p_company_id, 'adjust_stock', p_item_type, p_item_id, null,
      jsonb_build_object('movement_type', p_movement_type, 'quantity', v_signed_quantity), p_reason);
  end if;

  return v_movement_id;
end;
$$;

revoke all on function public.adjust_stock(uuid, uuid, text, uuid, text, numeric, numeric, text) from public;
grant execute on function public.adjust_stock(uuid, uuid, text, uuid, text, numeric, numeric, text) to authenticated;

-- =============================================================================
-- Caixa: abrir / fechar (fechamento calcula saldo esperado atomicamente).
-- =============================================================================
create or replace function public.open_cash_session(
  p_cash_register_id uuid,
  p_opening_balance numeric default 0
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_register public.cash_register;
  v_session_id uuid;
begin
  select * into v_register from public.cash_register where id = p_cash_register_id;
  if v_register.id is null then
    raise exception 'CAIXA_NAO_ENCONTRADO' using errcode = 'P0002';
  end if;
  if p_opening_balance < 0 then
    raise exception 'VALOR_INVALIDO' using errcode = '22023';
  end if;

  insert into public.cash_session (company_id, cash_register_id, unit_id, opened_by, opening_balance)
  values (v_register.company_id, p_cash_register_id, v_register.unit_id, auth.uid(), p_opening_balance)
  returning id into v_session_id;

  return v_session_id;
exception
  when unique_violation then
    raise exception 'CAIXA_JA_ABERTO' using errcode = '23505';
end;
$$;

revoke all on function public.open_cash_session(uuid, numeric) from public;
grant execute on function public.open_cash_session(uuid, numeric) to authenticated;

create or replace function public.close_cash_session(
  p_cash_session_id uuid,
  p_counted_balance numeric,
  p_notes text default null
)
returns public.cash_session
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_session public.cash_session;
  v_inflow numeric;
  v_outflow numeric;
  v_expected numeric;
begin
  select * into v_session from public.cash_session where id = p_cash_session_id;
  if v_session.id is null then
    raise exception 'SESSAO_NAO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if v_session.status <> 'open' then
    raise exception 'SESSAO_JA_FECHADA' using errcode = '22023';
  end if;
  if p_counted_balance < 0 then
    raise exception 'VALOR_INVALIDO' using errcode = '22023';
  end if;

  select coalesce(sum(amount), 0) into v_inflow
    from public.cash_movement
    where cash_session_id = p_cash_session_id and type in ('sale_payment', 'suprimento', 'other_in');

  select coalesce(sum(amount), 0) into v_outflow
    from public.cash_movement
    where cash_session_id = p_cash_session_id and type in ('sangria', 'other_out');

  v_expected := v_session.opening_balance + v_inflow - v_outflow;

  update public.cash_session
    set status = 'closed', closed_by = auth.uid(), closed_at = now(),
        expected_balance = v_expected, counted_balance = p_counted_balance,
        difference = p_counted_balance - v_expected, notes = p_notes
    where id = p_cash_session_id
    returning * into v_session;

  perform public.write_audit_log(v_session.company_id, 'close_cash_session', 'cash_session', p_cash_session_id, null,
    jsonb_build_object('expected', v_expected, 'counted', p_counted_balance, 'difference', p_counted_balance - v_expected));

  return v_session;
end;
$$;

revoke all on function public.close_cash_session(uuid, numeric, text) from public;
grant execute on function public.close_cash_session(uuid, numeric, text) to authenticated;

-- =============================================================================
-- Consolidação — fonte única de métricas para Dashboard/KPIs/Central/
-- Relatórios (seção 12). Definições no comentário de cada coluna seguem o
-- glossário da seção 13.
-- =============================================================================
create or replace function public.get_dashboard_metrics(
  p_company_id uuid,
  p_unit_id uuid default null,
  p_start date default current_date,
  p_end date default current_date
)
returns table (
  faturamento numeric,               -- soma de sale.total, status='completed', no período
  receita_recebida numeric,          -- soma de payment.amount, status='confirmed', no período
  estornos numeric,                  -- soma de payment.amount, status='refunded', no período
  ticket_medio numeric,              -- faturamento / quantidade de vendas completed
  atendimentos_count int,            -- attendance.status='completed' criados no período
  clientes_novos int,                -- clientes cujo 1º atendimento completed foi no período
  clientes_recorrentes int,          -- clientes com atendimento completed no período E antes dele
  cancelamentos_count int,           -- sale cancelled + attendance cancelled + appointment cancelled no período
  no_show_count int,                 -- appointment.status='no_show' no período
  ocupacao_real_minutos numeric,     -- soma de (ended_at - started_at) dos attendance_item no período
  ocupacao_planejada_minutos numeric,-- capacidade de jornada configurada no período (aprox., sem descontar bloqueios/ausências)
  comissoes_total numeric,           -- soma de commission.amount, status in (due,paid), no período
  caixa_saldo_atual numeric,         -- saldo das sessões de caixa abertas agora (não é filtrado por período)
  estoque_critico_count int          -- produtos+materiais ativos com estoque <= mínimo (não é filtrado por período)
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with escopo_unit as (
    select id from public.unit where company_id = p_company_id and (p_unit_id is null or id = p_unit_id)
  ),
  vendas as (
    select * from public.sale
    where company_id = p_company_id
      and unit_id in (select id from escopo_unit)
      and created_at::date between p_start and p_end
  ),
  pagamentos as (
    select p.* from public.payment p
    join public.sale s on s.id = p.sale_id
    where p.company_id = p_company_id
      and s.unit_id in (select id from escopo_unit)
      and p.created_at::date between p_start and p_end
  ),
  atendimentos as (
    select * from public.attendance
    where company_id = p_company_id
      and unit_id in (select id from escopo_unit)
      and created_at::date between p_start and p_end
  ),
  primeiro_atendimento as (
    select client_id, min(created_at::date) as primeira_data
    from public.attendance
    where company_id = p_company_id and status = 'completed'
    group by client_id
  ),
  timers as (
    select ai.* from public.attendance_item ai
    join public.attendance a on a.id = ai.attendance_id
    where a.company_id = p_company_id
      and a.unit_id in (select id from escopo_unit)
      and ai.started_at is not null and ai.ended_at is not null
      and ai.started_at::date between p_start and p_end
  ),
  jornada as (
    select ps.professional_id, ps.weekday,
      extract(epoch from (ps.end_time - ps.start_time)) / 60
        - coalesce((
            select sum(extract(epoch from (b.end_time - b.start_time)) / 60)
            from public.professional_schedule_break b
            where b.schedule_id = ps.id
          ), 0) as minutos_por_dia
    from public.professional_schedule ps
    join public.professional pr on pr.id = ps.professional_id
    where pr.company_id = p_company_id
      and (p_unit_id is null or pr.unit_id = p_unit_id)
      and ps.active
  ),
  dias_periodo as (
    select generate_series(p_start, p_end, interval '1 day')::date as dia
  ),
  capacidade as (
    select coalesce(sum(j.minutos_por_dia), 0) as total
    from dias_periodo d
    join jornada j on j.weekday = extract(dow from d.dia)
  ),
  comissoes as (
    select c.* from public.commission c
    where c.company_id = p_company_id
      and c.created_at::date between p_start and p_end
      and c.status in ('due', 'paid')
  ),
  cancelamentos as (
    select count(*) as total from (
      select id from vendas where status = 'cancelled'
      union all
      select id from atendimentos where status = 'cancelled'
      union all
      select id from public.appointment
        where company_id = p_company_id
          and unit_id in (select id from escopo_unit)
          and status in ('cancelled_by_client', 'cancelled_by_company')
    ) x
  ),
  no_shows as (
    select count(*) as total from public.appointment
    where company_id = p_company_id
      and unit_id in (select id from escopo_unit)
      and status = 'no_show'
  ),
  caixa_aberto as (
    select coalesce(sum(
      cs.opening_balance
      + coalesce((select sum(amount) from public.cash_movement where cash_session_id = cs.id and type in ('sale_payment','suprimento','other_in')), 0)
      - coalesce((select sum(amount) from public.cash_movement where cash_session_id = cs.id and type in ('sangria','other_out')), 0)
    ), 0) as saldo
    from public.cash_session cs
    join public.cash_register cr on cr.id = cs.cash_register_id
    where cs.company_id = p_company_id
      and cr.unit_id in (select id from escopo_unit)
      and cs.status = 'open'
  ),
  estoque_critico as (
    select
      (select count(*) from public.product where company_id = p_company_id and active and current_stock <= minimum_stock)
      +
      (select count(*) from public.consumable where company_id = p_company_id and active and current_stock <= minimum_stock)
      as total
  )
  select
    coalesce((select sum(total) from vendas where status = 'completed'), 0),
    coalesce((select sum(amount) from pagamentos where status = 'confirmed'), 0),
    coalesce((select sum(amount) from pagamentos where status = 'refunded'), 0),
    case
      when (select count(*) from vendas where status = 'completed') > 0
      then round((select sum(total) from vendas where status = 'completed') / (select count(*) from vendas where status = 'completed'), 2)
      else 0
    end,
    (select count(*) from atendimentos where status = 'completed'),
    (select count(*) from primeiro_atendimento where primeira_data between p_start and p_end),
    (select count(distinct a.client_id) from atendimentos a
      where a.status = 'completed'
        and exists (select 1 from primeiro_atendimento pa where pa.client_id = a.client_id and pa.primeira_data < p_start)),
    (select total from cancelamentos),
    (select total from no_shows),
    coalesce((select sum(extract(epoch from (ended_at - started_at)) / 60) from timers), 0),
    (select total from capacidade),
    coalesce((select sum(amount) from comissoes), 0),
    (select saldo from caixa_aberto),
    (select total from estoque_critico);
$$;

revoke all on function public.get_dashboard_metrics(uuid, uuid, date, date) from public;
grant execute on function public.get_dashboard_metrics(uuid, uuid, date, date) to authenticated;
