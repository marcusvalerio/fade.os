-- CORTEX.OS — fecha duas portas de escrita que ainda permitiam poluir o histórico.
--
-- 1. stock_movement é um ledger operacional: INSERT/UPDATE/DELETE direto por
--    usuário final permite fabricar histórico sem alterar o saldo real.
-- 2. A assinatura legada de create_pdv_sale não tinha idempotency_key e ainda
--    podia ser chamada diretamente via RPC, contornando a proteção nova.

-- ---------------------------------------------------------------------------
-- 1. Estoque: uma única porta operacional para movimentos manuais
-- ---------------------------------------------------------------------------
-- A tela /estoque já passa por adjustStockAction -> adjust_stock, que exige
-- gerente. Operações internas usam apply_stock_delta e rotinas atômicas.
revoke insert, update, delete on public.stock_movement from authenticated, anon;

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
security definer
set search_path = public, pg_temp
as $$
declare
  v_movement_id uuid;
  v_signed_quantity numeric;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if not public.has_company_management_access(p_company_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.unit u
    where u.id = p_unit_id and u.company_id = p_company_id
  ) then
    raise exception 'UNIDADE_INVALIDA' using errcode = '22023';
  end if;

  if p_item_type not in ('product', 'consumable') then
    raise exception 'TIPO_INVALIDO' using errcode = '22023';
  end if;
  if p_movement_type not in ('entry', 'consumption', 'adjustment', 'loss', 'inventory') then
    raise exception 'MOVIMENTO_INVALIDO' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity = 0 then
    raise exception 'QUANTIDADE_INVALIDA' using errcode = '22023';
  end if;
  if p_unit_cost is not null and p_unit_cost < 0 then
    raise exception 'CUSTO_INVALIDO' using errcode = '22023';
  end if;

  v_signed_quantity := case
    when p_movement_type = 'entry' then abs(p_quantity)
    when p_movement_type in ('consumption', 'loss') then -abs(p_quantity)
    else p_quantity
  end;

  -- A primitiva trava a linha, valida empresa/unidade e impede saldo negativo.
  perform public.apply_stock_delta(
    p_company_id, p_unit_id, p_item_type, p_item_id, v_signed_quantity
  );

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

  if p_movement_type in ('adjustment', 'loss', 'inventory') then
    perform public.write_audit_log(
      p_company_id, 'adjust_stock', p_item_type, p_item_id, null,
      jsonb_build_object('movement_type', p_movement_type, 'quantity', v_signed_quantity), p_reason
    );
  end if;

  return v_movement_id;
end;
$$;

revoke all on function public.adjust_stock(uuid, uuid, text, uuid, text, numeric, numeric, text) from public, anon;
grant execute on function public.adjust_stock(uuid, uuid, text, uuid, text, numeric, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. PDV: elimina a rota RPC legada sem idempotência
-- ---------------------------------------------------------------------------
-- A aplicação atual usa exclusivamente a assinatura de 9 argumentos.
-- Manter a assinatura antiga executável permitiria um consumidor autenticado
-- criar duas vendas em retries usando a rota antiga.
revoke all on function public.create_pdv_sale(uuid, uuid, uuid, jsonb, numeric, numeric, jsonb, text) from public, anon, authenticated;
