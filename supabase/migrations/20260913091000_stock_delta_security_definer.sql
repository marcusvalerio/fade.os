-- FADE OS — Teste operacional, pré-requisito do P0 #1.
--
-- A migration seguinte fecha UPDATE de `product` e `consumable` para quem não
-- é owner/admin. Isso quebraria a venda: `apply_stock_delta` é SECURITY
-- INVOKER e é ela quem dá baixa no saldo, chamada por close_attendance e
-- create_pdv_sale (também SECURITY INVOKER) — ou seja, hoje a baixa acontece
-- com o privilégio do barbeiro que está vendendo, e é isso mesmo que deve
-- continuar acontecendo.
--
-- A saída é separar as duas coisas que hoje andam juntas na policy de UPDATE:
-- "mexer no saldo" (operacional, todo mundo que vende) e "mexer no cadastro"
-- (administrativo, só gestão). O saldo passa a ser escrito exclusivamente por
-- esta função, com o privilégio do dono; o cadastro fica trancado na RLS.
--
-- Ao ganhar SECURITY DEFINER a função deixa de ser protegida pelo RLS de
-- product/consumable, então a checagem de tenant que o RLS fazia volta
-- explícita: p_company_id precisa ser uma empresa do chamador. Sem isso, a
-- função viraria uma porta para mexer no estoque de qualquer empresa.
--
-- Não é destrutivo: nenhum saldo é alterado.
create or replace function public.apply_stock_delta(
  p_company_id uuid,
  p_unit_id uuid,
  p_item_type text,
  p_item_id uuid,
  p_delta numeric
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_stock numeric;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  -- O que o RLS garantia antes de a função virar SECURITY DEFINER.
  if p_company_id is null or p_company_id not in (select public.my_company_ids()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

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

  -- Só a coluna de saldo. Nenhum outro campo do cadastro é alcançável por
  -- aqui, então esta porta não reabre o bypass de preço.
  if p_item_type = 'product' then
    update public.product set current_stock = current_stock + p_delta where id = p_item_id;
  else
    update public.consumable set current_stock = current_stock + p_delta where id = p_item_id;
  end if;

  return v_stock + p_delta;
end;
$$;

revoke all on function public.apply_stock_delta(uuid, uuid, text, uuid, numeric) from public, anon;
grant execute on function public.apply_stock_delta(uuid, uuid, text, uuid, numeric) to authenticated;
