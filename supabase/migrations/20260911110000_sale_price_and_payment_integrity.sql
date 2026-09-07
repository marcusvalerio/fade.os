-- FADE OS — FASE 4: integridade financeira da venda.
--
-- Problemas (docs/auditoria-pre-piloto.md, P0.5 e P0.6):
--
--   1. create_pdv_sale lia unit_price do JSON enviado pelo navegador e nunca
--      confrontava com product.sale_price. Um cliente modificado fechava uma
--      venda de R$ 200 por R$ 1, e o registro ficava internamente consistente
--      porque o backend nunca teve o preço certo.
--   2. Tanto create_pdv_sale quanto close_attendance aceitavam
--      p_payments = '[]' e ainda assim gravavam sale.status = 'completed'. A
--      conferência da soma só rodava quando o array NÃO estava vazio.
--
-- Depende de public.apply_stock_delta (20260911100000_atomic_stock.sql).

-- ---------------------------------------------------------------------------
-- Autorização de desconto
-- ---------------------------------------------------------------------------
-- Seção 7: preço alterado à mão precisa de regra explícita de autorização.
-- Desconto e acréscimo, no item ou no total, são exatamente isso — passam a
-- exigir owner/admin. Um profissional continua fechando venda e atendimento
-- normalmente; só não decide sozinho o quanto a casa deixa de receber.
create or replace function public.assert_can_change_price(p_company_id uuid)
returns void
language plpgsql
stable
set search_path = public, pg_temp
as $$
begin
  if not public.has_company_management_access(p_company_id) then
    raise exception 'DESCONTO_NAO_AUTORIZADO' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_can_change_price(uuid) from public;
grant execute on function public.assert_can_change_price(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- create_pdv_sale
-- ---------------------------------------------------------------------------
create or replace function public.create_pdv_sale(
  p_company_id uuid,
  p_unit_id uuid,
  p_client_id uuid default null,
  p_items jsonb default '[]'::jsonb,
  p_discount_amount numeric default 0,
  p_surcharge_amount numeric default 0,
  p_payments jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_subtotal numeric := 0;
  v_total numeric;
  v_sale_id uuid;
  v_item jsonb;
  v_item_count int;
  v_payment_sum numeric := 0;
  v_cash_session_id uuid;
  v_payment jsonb;
  v_price_changed boolean := false;
begin
  v_item_count := jsonb_array_length(coalesce(p_items, '[]'::jsonb));
  if v_item_count = 0 then
    raise exception 'VENDA_SEM_ITENS' using errcode = '22023';
  end if;

  if p_discount_amount is null or p_surcharge_amount is null
     or p_discount_amount < 0 or p_surcharge_amount < 0 then
    raise exception 'VALOR_INVALIDO' using errcode = '22023';
  end if;

  if p_client_id is not null and not exists (
    select 1 from public.client c where c.id = p_client_id and c.company_id = p_company_id
  ) then
    raise exception 'CLIENTE_INVALIDO' using errcode = '22023';
  end if;

  if not exists (select 1 from public.unit u where u.id = p_unit_id and u.company_id = p_company_id) then
    raise exception 'UNIDADE_INVALIDA' using errcode = '22023';
  end if;

  -- Subtotal derivado do banco. O unit_price que vier no payload é ignorado:
  -- o preço é product.sale_price, sempre. Só o desconto é negociável, e
  -- apenas dentro do limite do próprio item.
  for v_item in select * from jsonb_array_elements(p_items) loop
    declare
      v_product_id uuid := (v_item->>'product_id')::uuid;
      v_quantity numeric := (v_item->>'quantity')::numeric;
      v_discount numeric := coalesce((v_item->>'discount')::numeric, 0);
      v_sale_price numeric;
      v_gross numeric;
    begin
      if v_quantity is null or v_quantity <= 0 then
        raise exception 'QUANTIDADE_INVALIDA' using errcode = '22023';
      end if;
      if v_discount < 0 then
        raise exception 'VALOR_INVALIDO' using errcode = '22023';
      end if;

      select sale_price into v_sale_price
        from public.product
        where id = v_product_id and company_id = p_company_id and unit_id = p_unit_id and active;

      if v_sale_price is null then
        raise exception 'PRODUTO_INVALIDO' using errcode = '22023';
      end if;

      v_gross := v_sale_price * v_quantity;
      if v_discount > v_gross then
        raise exception 'DESCONTO_MAIOR_QUE_SUBTOTAL' using errcode = '22023';
      end if;
      if v_discount > 0 then
        v_price_changed := true;
      end if;

      v_subtotal := v_subtotal + (v_gross - v_discount);
    end;
  end loop;

  if p_discount_amount > v_subtotal then
    raise exception 'DESCONTO_MAIOR_QUE_SUBTOTAL' using errcode = '22023';
  end if;
  if p_discount_amount > 0 or p_surcharge_amount > 0 then
    v_price_changed := true;
  end if;

  if v_price_changed then
    perform public.assert_can_change_price(p_company_id);
  end if;

  v_total := round(v_subtotal - p_discount_amount + p_surcharge_amount, 2);

  -- Venda de PDV é sempre à vista e sai concluída: sem pagamento ela não pode
  -- existir. A soma tem que bater com o total, com folga de 1 centavo para
  -- arredondamento de parcela.
  select coalesce(sum((p->>'amount')::numeric), 0) into v_payment_sum
    from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) p;

  if jsonb_array_length(coalesce(p_payments, '[]'::jsonb)) = 0 then
    raise exception 'VENDA_SEM_PAGAMENTO' using errcode = '22023';
  end if;
  if abs(v_payment_sum - v_total) > 0.01 then
    raise exception 'PAGAMENTO_NAO_CONFERE' using errcode = '22023';
  end if;

  insert into public.sale (
    company_id, unit_id, client_id, attendance_id, status,
    subtotal, discount_amount, surcharge_amount, total, created_by
  )
  values (
    p_company_id, p_unit_id, p_client_id, null, 'completed',
    v_subtotal, p_discount_amount, p_surcharge_amount, v_total, auth.uid()
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
        where id = v_product_id and company_id = p_company_id and unit_id = p_unit_id;

      v_item_total := v_sale_price * v_quantity - v_discount;
      v_alloc_ratio := case when v_subtotal > 0 then v_item_total / v_subtotal else 0 end;
      v_item_total := round(
        v_item_total - (p_discount_amount * v_alloc_ratio) + (p_surcharge_amount * v_alloc_ratio), 2
      );

      insert into public.sale_item (
        sale_id, company_id, kind, product_id, quantity, unit_price, discount, total
      )
      values (v_sale_id, p_company_id, 'product', v_product_id, v_quantity, v_sale_price, v_discount, v_item_total)
      returning id into v_sale_item_id;

      -- Baixa atômica: a trava de linha impede que duas vendas simultâneas do
      -- último item passem as duas.
      perform public.apply_stock_delta(p_company_id, p_unit_id, 'product', v_product_id, -v_quantity);

      insert into public.stock_movement (
        company_id, unit_id, item_type, product_id, movement_type, quantity,
        reference_type, reference_id, created_by
      )
      values (
        p_company_id, p_unit_id, 'product', v_product_id, 'sale', -v_quantity,
        'sale_item', v_sale_item_id, auth.uid()
      );
    end;
  end loop;

  select cs.id into v_cash_session_id
    from public.cash_session cs
    join public.cash_register cr on cr.id = cs.cash_register_id
    where cr.unit_id = p_unit_id and cs.status = 'open'
    order by cs.opened_at desc
    limit 1;

  for v_payment in select * from jsonb_array_elements(p_payments) loop
    declare
      v_method text := v_payment->>'method';
      v_amount numeric := (v_payment->>'amount')::numeric;
      v_payment_id uuid;
    begin
      if v_amount is null or v_amount <= 0 then
        raise exception 'VALOR_PAGAMENTO_INVALIDO' using errcode = '22023';
      end if;

      if not exists (
        select 1 from public.payment_method pm
        where pm.company_id = p_company_id and pm.method = v_method and pm.active
      ) then
        raise exception 'METODO_PAGAMENTO_INVALIDO' using errcode = '22023';
      end if;

      insert into public.payment (company_id, sale_id, method, amount, status, cash_session_id, created_by)
      values (p_company_id, v_sale_id, v_method, v_amount, 'confirmed', v_cash_session_id, auth.uid())
      returning id into v_payment_id;

      if v_cash_session_id is not null and v_method = 'cash' then
        insert into public.cash_movement (
          company_id, cash_session_id, type, amount, method, reference_type, reference_id, created_by
        )
        values (
          p_company_id, v_cash_session_id, 'sale_payment', v_amount, v_method,
          'payment', v_payment_id, auth.uid()
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
$$;

-- ---------------------------------------------------------------------------
-- close_attendance
-- ---------------------------------------------------------------------------
-- Os preços aqui já vêm de attendance_item (linhas do banco, não do payload);
-- quem passa a garantir que essas linhas nasceram com o preço de catálogo é a
-- camada de Server Action. O que muda nesta função:
--
--   - pagamento passa a ser obrigatório quando o total é maior que zero;
--   - um atendimento 100% cortesia (total zero) só fecha SEM pagamento;
--   - desconto/acréscimo no total exigem owner/admin;
--   - a baixa de estoque vira atômica e respeita a unidade.
create or replace function public.close_attendance(
  p_attendance_id uuid,
  p_discount_amount numeric default 0,
  p_surcharge_amount numeric default 0,
  p_payments jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
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
  v_payment_count int;
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

  if p_discount_amount is null or p_surcharge_amount is null
     or p_discount_amount < 0 or p_surcharge_amount < 0 then
    raise exception 'VALOR_INVALIDO' using errcode = '22023';
  end if;

  select coalesce(sum(final_price), 0) into v_subtotal
    from public.attendance_item where attendance_id = p_attendance_id;

  if p_discount_amount > v_subtotal then
    raise exception 'DESCONTO_MAIOR_QUE_SUBTOTAL' using errcode = '22023';
  end if;

  if p_discount_amount > 0 or p_surcharge_amount > 0 then
    perform public.assert_can_change_price(v_attendance.company_id);
  end if;

  v_total := round(v_subtotal - p_discount_amount + p_surcharge_amount, 2);

  v_payment_count := jsonb_array_length(coalesce(p_payments, '[]'::jsonb));
  select coalesce(sum((p->>'amount')::numeric), 0) into v_payment_sum
    from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) p;

  if v_total > 0 then
    -- Fechar sem pagamento gerava venda concluída, comissão e baixa de
    -- estoque com zero recebido e nada no financeiro.
    if v_payment_count = 0 then
      raise exception 'VENDA_SEM_PAGAMENTO' using errcode = '22023';
    end if;
    if abs(v_payment_sum - v_total) > 0.01 then
      raise exception 'PAGAMENTO_NAO_CONFERE' using errcode = '22023';
    end if;
  elsif v_payment_count > 0 then
    -- Cortesia integral: não há o que cobrar, então qualquer pagamento
    -- informado está errado.
    raise exception 'PAGAMENTO_NAO_CONFERE' using errcode = '22023';
  end if;

  insert into public.sale (
    company_id, unit_id, client_id, attendance_id, status,
    subtotal, discount_amount, surcharge_amount, total, created_by
  )
  values (
    v_attendance.company_id, v_attendance.unit_id, v_attendance.client_id, p_attendance_id, 'completed',
    v_subtotal, p_discount_amount, p_surcharge_amount, v_total, auth.uid()
  )
  returning id into v_sale_id;

  for v_item in select * from public.attendance_item where attendance_id = p_attendance_id loop
    v_alloc_ratio := case when v_subtotal > 0 then v_item.final_price / v_subtotal else 0 end;
    v_item_total := round(
      v_item.final_price - (p_discount_amount * v_alloc_ratio) + (p_surcharge_amount * v_alloc_ratio), 2
    );

    insert into public.sale_item (
      sale_id, company_id, kind, service_id, product_id, attendance_item_id, professional_id,
      quantity, unit_price, discount, is_courtesy, total
    )
    values (
      v_sale_id, v_attendance.company_id, v_item.kind, v_item.service_id, v_item.product_id,
      v_item.id, v_item.professional_id,
      coalesce(v_item.quantity, 1), v_item.original_price, v_item.discount,
      v_item.type = 'courtesy', v_item_total
    )
    returning id into v_sale_item_id;

    if v_item.kind = 'service' and v_item.professional_id is not null then
      select coalesce(
        (select default_commission_percent from public.service where id = v_item.service_id),
        (select default_commission_percent from public.professional where id = v_item.professional_id),
        0
      ) into v_commission_percent;

      v_commission_amount := round(v_item_total * v_commission_percent / 100, 2);

      insert into public.commission (
        company_id, sale_item_id, professional_id, base_amount, percent, amount, status
      )
      values (
        v_attendance.company_id, v_sale_item_id, v_item.professional_id,
        v_item_total, v_commission_percent, v_commission_amount, 'due'
      );

      update public.attendance_item
        set commission_percent_snapshot = v_commission_percent, commission_amount = v_commission_amount
        where id = v_item.id;
    end if;

    -- Cortesia consome estoque igual: o produto saiu da prateleira mesmo sem
    -- ter sido cobrado.
    if v_item.kind = 'product' and v_item.product_id is not null then
      perform public.apply_stock_delta(
        v_attendance.company_id, v_attendance.unit_id, 'product',
        v_item.product_id, -coalesce(v_item.quantity, 1)
      );

      insert into public.stock_movement (
        company_id, unit_id, item_type, product_id, movement_type, quantity,
        reference_type, reference_id, created_by
      )
      values (
        v_attendance.company_id, v_attendance.unit_id, 'product', v_item.product_id, 'sale',
        -coalesce(v_item.quantity, 1), 'sale_item', v_sale_item_id, auth.uid()
      );
    end if;
  end loop;

  select cs.id into v_cash_session_id
    from public.cash_session cs
    join public.cash_register cr on cr.id = cs.cash_register_id
    where cr.unit_id = v_attendance.unit_id and cs.status = 'open'
    order by cs.opened_at desc
    limit 1;

  for v_payment in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    declare
      v_method text := v_payment->>'method';
      v_amount numeric := (v_payment->>'amount')::numeric;
      v_payment_id uuid;
    begin
      if v_amount is null or v_amount <= 0 then
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
        insert into public.cash_movement (
          company_id, cash_session_id, type, amount, method, reference_type, reference_id, created_by
        )
        values (
          v_attendance.company_id, v_cash_session_id, 'sale_payment', v_amount, v_method,
          'payment', v_payment_id, auth.uid()
        );
      end if;

      insert into public.financial_entry (
        company_id, unit_id, type, category, description, amount,
        reference_type, reference_id, entry_date, created_by
      )
      values (
        v_attendance.company_id, v_attendance.unit_id, 'income', 'venda', 'Pagamento de venda', v_amount,
        'payment', v_payment_id, current_date, auth.uid()
      );
    end;
  end loop;

  update public.attendance set status = 'completed', updated_at = now() where id = p_attendance_id;

  perform public.write_audit_log(
    v_attendance.company_id, 'close_attendance', 'sale', v_sale_id, null,
    jsonb_build_object('total', v_total, 'discount_amount', p_discount_amount,
                       'surcharge_amount', p_surcharge_amount)
  );

  return v_sale_id;
end;
$$;
