-- CORTEX.OS — idempotência real do fechamento do PDV
--
-- 20260926140000 tentou introduzir a chave, mas delegava a RPC para um
-- helper que não existia. 20260926140001 removeu a coluna/índice novamente.
-- Esta migration implementa a solução completa, sem depender de helper.
--
-- A aplicação gera uma chave por tentativa de checkout e a reutiliza em
-- retries. A chave é única por empresa. Um retry da mesma tentativa retorna
-- a venda já criada; uma chave diferente continua sendo uma venda distinta.

alter table public.sale
  add column if not exists idempotency_key text;

create unique index if not exists sale_company_idempotency_key_uq
  on public.sale (company_id, idempotency_key)
  where idempotency_key is not null;

comment on column public.sale.idempotency_key is
  'Chave de idempotência fornecida pela aplicação para uma tentativa de fechamento do PDV; única por empresa.';

-- Mantém a operação financeira inteira na mesma transação da chave. O lock
-- serializa duas requisições concorrentes com a mesma chave antes do INSERT.
create or replace function public.create_pdv_sale(
  p_company_id uuid,
  p_unit_id uuid,
  p_client_id uuid default null::uuid,
  p_items jsonb default '[]'::jsonb,
  p_discount_amount numeric default 0,
  p_surcharge_amount numeric default 0,
  p_payments jsonb default '[]'::jsonb,
  p_authorization_code text default null::text,
  p_idempotency_key text default null::text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_subtotal numeric := 0;
  v_total numeric;
  v_sale_id uuid;
  v_existing_sale_id uuid;
  v_item jsonb;
  v_item_count int;
  v_payment_sum numeric := 0;
  v_cash_session_id uuid;
  v_payment jsonb;
  v_price_changed boolean := false;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.user_company_role ucr
    where ucr.user_id = auth.uid() and ucr.company_id = p_company_id
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_idempotency_key is not null then
    p_idempotency_key := nullif(btrim(p_idempotency_key), '');
    if p_idempotency_key is null or length(p_idempotency_key) > 128 then
      raise exception 'CHAVE_IDEMPOTENCIA_INVALIDA' using errcode = '22023';
    end if;

    perform pg_advisory_xact_lock(
      hashtextextended(p_company_id::text || ':' || p_idempotency_key, 0)
    );

    select id into v_existing_sale_id
      from public.sale
     where company_id = p_company_id
       and idempotency_key = p_idempotency_key
     limit 1;

    if v_existing_sale_id is not null then
      return v_existing_sale_id;
    end if;
  end if;

  v_item_count := jsonb_array_length(coalesce(p_items,'[]'::jsonb));
  if v_item_count = 0 then
    raise exception 'VENDA_SEM_ITENS' using errcode='22023';
  end if;

  if p_discount_amount is null or p_surcharge_amount is null or p_discount_amount < 0 or p_surcharge_amount < 0 then
    raise exception 'VALOR_INVALIDO' using errcode='22023';
  end if;

  if p_client_id is not null and not exists (
    select 1 from public.client c
    where c.id=p_client_id and c.company_id=p_company_id
  ) then
    raise exception 'CLIENTE_INVALIDO' using errcode='22023';
  end if;

  if not exists (
    select 1 from public.unit u
    where u.id=p_unit_id and u.company_id=p_company_id
  ) then
    raise exception 'UNIDADE_INVALIDA' using errcode='22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    declare
      v_product_id uuid := (v_item->>'product_id')::uuid;
      v_quantity numeric := (v_item->>'quantity')::numeric;
      v_discount numeric := coalesce((v_item->>'discount')::numeric, 0);
      v_sale_price numeric;
      v_gross numeric;
    begin
      if v_quantity is null or v_quantity <= 0 then
        raise exception 'QUANTIDADE_INVALIDA' using errcode='22023';
      end if;
      if v_discount < 0 then
        raise exception 'VALOR_INVALIDO' using errcode='22023';
      end if;

      select sale_price into v_sale_price
        from public.product
       where id=v_product_id
         and company_id=p_company_id
         and unit_id=p_unit_id
         and active;

      if v_sale_price is null then
        raise exception 'PRODUTO_INVALIDO' using errcode='22023';
      end if;

      v_gross := v_sale_price * v_quantity;
      if v_discount > v_gross then
        raise exception 'DESCONTO_MAIOR_QUE_SUBTOTAL' using errcode='22023';
      end if;
      if v_discount > 0 then
        v_price_changed := true;
      end if;
      v_subtotal := v_subtotal + (v_gross - v_discount);
    end;
  end loop;

  if p_discount_amount > v_subtotal then
    raise exception 'DESCONTO_MAIOR_QUE_SUBTOTAL' using errcode='22023';
  end if;
  if p_discount_amount > 0 or p_surcharge_amount > 0 then
    v_price_changed := true;
  end if;

  if v_price_changed then
    if p_authorization_code is not null then
      perform public.authorize_operation(p_company_id, p_authorization_code, 'discount');
    end if;
    perform public.assert_operation_authorized(p_company_id, 'discount');
  end if;

  v_total := round(v_subtotal - p_discount_amount + p_surcharge_amount, 2);

  select coalesce(sum((p->>'amount')::numeric),0)
    into v_payment_sum
    from jsonb_array_elements(coalesce(p_payments,'[]'::jsonb)) p;

  if jsonb_array_length(coalesce(p_payments,'[]'::jsonb)) = 0 then
    raise exception 'VENDA_SEM_PAGAMENTO' using errcode='22023';
  end if;
  if abs(v_payment_sum - v_total) > 0.01 then
    raise exception 'PAGAMENTO_NAO_CONFERE' using errcode='22023';
  end if;

  insert into public.sale (
    company_id, unit_id, client_id, attendance_id, status,
    subtotal, discount_amount, surcharge_amount, total, created_by,
    idempotency_key
  )
  values (
    p_company_id, p_unit_id, p_client_id, null, 'completed',
    v_subtotal, p_discount_amount, p_surcharge_amount, v_total, auth.uid(),
    p_idempotency_key
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    declare
      v_product_id uuid := (v_item->>'product_id')::uuid;
      v_quantity numeric := (v_item->>'quantity')::numeric;
      v_discount numeric := coalesce((v_item->>'discount')::numeric, 0);
      v_sale_price numeric;
      v_item_total numeric;
      v_alloc_ratio numeric;
      v_sale_item_id uuid;
    begin
      select sale_price into v_sale_price
        from public.product
       where id=v_product_id
         and company_id=p_company_id
         and unit_id=p_unit_id;

      v_item_total := v_sale_price * v_quantity - v_discount;
      v_alloc_ratio := case when v_subtotal > 0 then v_item_total / v_subtotal else 0 end;
      v_item_total := round(
        v_item_total - (p_discount_amount*v_alloc_ratio) + (p_surcharge_amount*v_alloc_ratio),
        2
      );

      insert into public.sale_item (
        sale_id, company_id, kind, product_id, quantity, unit_price, discount, total
      )
      values (
        v_sale_id, p_company_id, 'product', v_product_id, v_quantity,
        v_sale_price, v_discount, v_item_total
      )
      returning id into v_sale_item_id;

      perform public.apply_stock_delta(
        p_company_id, p_unit_id, 'product', v_product_id, -v_quantity
      );

      insert into public.stock_movement (
        company_id, unit_id, item_type, product_id, movement_type,
        quantity, reference_type, reference_id, created_by
      )
      values (
        p_company_id, p_unit_id, 'product', v_product_id, 'sale',
        -v_quantity, 'sale_item', v_sale_item_id, auth.uid()
      );
    end;
  end loop;

  select cs.id into v_cash_session_id
    from public.cash_session cs
    join public.cash_register cr on cr.id = cs.cash_register_id
   where cr.unit_id = p_unit_id
     and cs.status='open'
   order by cs.opened_at desc
   limit 1;

  for v_payment in select * from jsonb_array_elements(p_payments) loop
    declare
      v_method text := v_payment->>'method';
      v_amount numeric := (v_payment->>'amount')::numeric;
      v_payment_id uuid;
    begin
      if v_amount is null or v_amount <= 0 then
        raise exception 'VALOR_PAGAMENTO_INVALIDO' using errcode='22023';
      end if;

      if not exists (
        select 1 from public.payment_method pm
        where pm.company_id=p_company_id
          and pm.method=v_method
          and pm.active
      ) then
        raise exception 'METODO_PAGAMENTO_INVALIDO' using errcode='22023';
      end if;

      insert into public.payment (
        company_id, sale_id, method, amount, status, cash_session_id, created_by
      )
      values (
        p_company_id, v_sale_id, v_method, v_amount,
        'confirmed', v_cash_session_id, auth.uid()
      )
      returning id into v_payment_id;

      if v_cash_session_id is not null and v_method='cash' then
        insert into public.cash_movement (
          company_id, cash_session_id, type, amount, method,
          reference_type, reference_id, created_by
        )
        values (
          p_company_id, v_cash_session_id, 'sale_payment', v_amount,
          v_method, 'payment', v_payment_id, auth.uid()
        );
      end if;

      insert into public.financial_entry (
        company_id, unit_id, type, category, description, amount,
        reference_type, reference_id, entry_date, created_by
      )
      values (
        p_company_id, p_unit_id, 'income', 'venda_pdv', 'Venda PDV', v_amount,
        'payment', v_payment_id, current_date, auth.uid()
      );
    end;
  end loop;

  perform public.write_audit_log(
    p_company_id, 'create_pdv_sale', 'sale', v_sale_id, null,
    jsonb_build_object('total', v_total, 'items', v_item_count)
  );

  return v_sale_id;
end;
$function$;

-- A assinatura antiga continua existindo para compatibilidade com chamadas
-- legadas. A ação atual do PDV passa explicitamente a usar a assinatura de
-- nove argumentos abaixo. Não removemos nem alteramos a função de oito args.
revoke all on function public.create_pdv_sale(uuid, uuid, uuid, jsonb, numeric, numeric, jsonb, text, text) from public, anon;
grant execute on function public.create_pdv_sale(uuid, uuid, uuid, jsonb, numeric, numeric, jsonb, text, text) to authenticated;
