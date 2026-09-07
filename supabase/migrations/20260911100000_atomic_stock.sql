-- FADE OS — FASE 5: estoque atômico e não-negativo.
--
-- Problema (docs/auditoria-pre-piloto.md, P0.7 e P1.4): toda baixa de estoque
-- seguia o padrão `select current_stock` → compara → `update ... - qtd`, sem
-- lock. Duas vendas simultâneas do último item passam ambas na verificação e
-- o saldo termina negativo. close_attendance nem verificava. E nenhuma das
-- funções confrontava product.unit_id com a unidade da venda, então uma venda
-- da unidade A consumia estoque da unidade B.
--
-- Esta migration não altera nenhum saldo existente (verificado: zero linhas
-- com current_stock < 0 em product e consumable no momento da aplicação).

-- ---------------------------------------------------------------------------
-- 1. Barreira final: o banco recusa saldo negativo
-- ---------------------------------------------------------------------------
-- Última linha de defesa. Mesmo que apareça um caminho de escrita novo que
-- esqueça a verificação, o estoque não fica inconsistente — a transação
-- inteira falha.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.product'::regclass and conname = 'product_current_stock_non_negative'
  ) then
    alter table public.product
      add constraint product_current_stock_non_negative check (current_stock >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.consumable'::regclass and conname = 'consumable_current_stock_non_negative'
  ) then
    alter table public.consumable
      add constraint consumable_current_stock_non_negative check (current_stock >= 0);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Primitiva única de movimentação de saldo
-- ---------------------------------------------------------------------------
-- Todo caminho que mexe em saldo passa por aqui. O `for update` é o ponto
-- central: em READ COMMITTED, uma transação concorrente bloqueia na trava e,
-- ao obtê-la, relê a versão já commitada da linha. Ou seja, a verificação de
-- saldo enxerga o resultado da outra venda em vez de um valor obsoleto.
--
-- SECURITY INVOKER de propósito: o RLS de product/consumable continua valendo
-- e o cruzamento de tenant é checado explicitamente por company_id + unit_id.
create or replace function public.apply_stock_delta(
  p_company_id uuid,
  p_unit_id uuid,
  p_item_type text,
  p_item_id uuid,
  p_delta numeric
)
returns numeric
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_stock numeric;
begin
  if p_item_type not in ('product', 'consumable') then
    raise exception 'TIPO_INVALIDO' using errcode = '22023';
  end if;

  if p_item_type = 'product' then
    select current_stock into v_stock
      from public.product
      where id = p_item_id and company_id = p_company_id and unit_id = p_unit_id
      for update;
  else
    select current_stock into v_stock
      from public.consumable
      where id = p_item_id and company_id = p_company_id and unit_id = p_unit_id
      for update;
  end if;

  -- Não existe, é de outra empresa, ou é de outra unidade — os três casos são
  -- indistinguíveis de propósito, para não virar um oráculo de existência.
  if v_stock is null then
    raise exception 'ITEM_ESTOQUE_INVALIDO' using errcode = '22023';
  end if;

  if v_stock + p_delta < 0 then
    raise exception 'ESTOQUE_INSUFICIENTE' using errcode = '22023';
  end if;

  if p_item_type = 'product' then
    update public.product set current_stock = current_stock + p_delta where id = p_item_id;
  else
    update public.consumable set current_stock = current_stock + p_delta where id = p_item_id;
  end if;

  return v_stock + p_delta;
end;
$$;

revoke all on function public.apply_stock_delta(uuid, uuid, text, uuid, numeric) from public;
grant execute on function public.apply_stock_delta(uuid, uuid, text, uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. adjust_stock passa a usar a primitiva
-- ---------------------------------------------------------------------------
-- Mudanças em relação à versão anterior: valida empresa e unidade do item,
-- recusa saldo negativo, e grava o movimento DEPOIS de conseguir aplicar o
-- delta — antes, um ajuste impossível deixava um stock_movement órfão
-- registrando uma baixa que nunca aconteceu.
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
  if p_quantity is null or p_quantity = 0 then
    raise exception 'QUANTIDADE_INVALIDA' using errcode = '22023';
  end if;

  v_signed_quantity := case
    when p_movement_type = 'entry' then abs(p_quantity)
    when p_movement_type in ('consumption', 'loss') then -abs(p_quantity)
    else p_quantity
  end;

  perform public.apply_stock_delta(p_company_id, p_unit_id, p_item_type, p_item_id, v_signed_quantity);

  insert into public.stock_movement (
    company_id, unit_id, item_type, product_id, consumable_id,
    movement_type, quantity, unit_cost, reason, created_by
  )
  values (
    p_company_id, p_unit_id, p_item_type,
    case when p_item_type = 'product' then p_item_id end,
    case when p_item_type = 'consumable' then p_item_id end,
    p_movement_type, v_signed_quantity, p_unit_cost, p_reason, auth.uid()
  )
  returning id into v_movement_id;

  if p_movement_type in ('adjustment', 'loss') then
    perform public.write_audit_log(
      p_company_id, 'adjust_stock', p_item_type, p_item_id, null,
      jsonb_build_object('movement_type', p_movement_type, 'quantity', v_signed_quantity), p_reason
    );
  end if;

  return v_movement_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. cancel_sale devolve o estoque pela mesma primitiva
-- ---------------------------------------------------------------------------
-- O estorno é sempre um delta positivo, então nunca esbarra na verificação de
-- saldo; passa pela primitiva para que a trava de linha seja a mesma de uma
-- venda concorrente do mesmo produto.
create or replace function public.cancel_sale(p_sale_id uuid, p_reason text)
returns void
language plpgsql
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
      perform public.apply_stock_delta(
        v_sale.company_id, v_sale.unit_id, 'product', v_item.product_id, v_item.quantity
      );

      insert into public.stock_movement (
        company_id, unit_id, item_type, product_id, movement_type, quantity,
        reference_type, reference_id, reason, created_by
      )
      values (
        v_sale.company_id, v_sale.unit_id, 'product', v_item.product_id, 'adjustment', v_item.quantity,
        'sale_cancel', p_sale_id, 'Estorno de venda cancelada', auth.uid()
      );
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
      insert into public.cash_movement (
        company_id, cash_session_id, type, amount, method, reference_type, reference_id, reason, created_by
      )
      values (
        v_sale.company_id, v_payment.cash_session_id, 'other_out', v_payment.amount, v_payment.method,
        'payment_refund', v_payment.id, p_reason, auth.uid()
      );
    end if;

    insert into public.financial_entry (
      company_id, unit_id, type, category, description, amount,
      reference_type, reference_id, entry_date, created_by
    )
    values (
      v_sale.company_id, v_sale.unit_id, 'expense', 'estorno', 'Estorno de pagamento', v_payment.amount,
      'payment_refund', v_payment.id, current_date, auth.uid()
    );
  end loop;

  update public.sale
    set status = 'cancelled', cancelled_at = now(), cancelled_reason = p_reason,
        cancelled_by = auth.uid(), updated_at = now()
    where id = p_sale_id;

  if v_sale.attendance_id is not null then
    update public.attendance set status = 'cancelled', updated_at = now()
      where id = v_sale.attendance_id and status = 'completed';
  end if;

  perform public.write_audit_log(
    v_sale.company_id, 'cancel_sale', 'sale', p_sale_id,
    jsonb_build_object('status', v_sale.status), jsonb_build_object('status', 'cancelled'), p_reason
  );
end;
$$;
