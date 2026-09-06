-- FADE OS — Prova de Fogo 1, Bloco A: PDV real sobre o mesmo núcleo
-- comercial da Fase 4 (sale/sale_item/payment/stock_movement/
-- cash_movement/financial_entry). Nenhuma tabela nova, nenhuma segunda
-- implementação de venda — só o que faltava para uma venda existir sem
-- atendimento: cliente opcional e uma função de orquestração equivalente
-- a close_attendance(), mas para produtos avulsos.
--
-- Descoberta ao inspecionar antes de alterar (regra principal da Prova de
-- Fogo): `sale.client_id` era NOT NULL — a Fase 4 sempre associava a venda
-- ao cliente do atendimento de origem, que por sua vez também é NOT NULL.
-- Isso bloqueia exatamente o caso "cliente não quer se identificar" que
-- este bloco pede. `cancel_sale()` já funciona genericamente por
-- sale_item (não assume atendimento) — reaproveitado sem nenhuma
-- alteração para cancelar vendas de PDV.

alter table public.sale alter column client_id drop not null;

-- Reescreve a validação cross-tenant só na parte que muda: client_id
-- agora pode ser nulo, então o check correspondente vira condicional. O
-- resto (unit/attendance) é idêntico ao que já existia.
create or replace function public.check_sale_same_company()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  v_unit_company uuid;
  v_client_company uuid;
  v_attendance_company uuid;
begin
  select company_id into v_unit_company from public.unit where id = new.unit_id;
  if v_unit_company is null or v_unit_company <> new.company_id then
    raise exception 'Unidade precisa pertencer à mesma empresa da venda.';
  end if;

  if new.client_id is not null then
    select company_id into v_client_company from public.client where id = new.client_id;
    if v_client_company is null or v_client_company <> new.company_id then
      raise exception 'Cliente precisa pertencer à mesma empresa da venda.';
    end if;
  end if;

  if new.attendance_id is not null then
    select company_id into v_attendance_company from public.attendance where id = new.attendance_id;
    if v_attendance_company is null or v_attendance_company <> new.company_id then
      raise exception 'Atendimento de origem precisa pertencer à mesma empresa da venda.';
    end if;
  end if;
  return new;
end;
$$;

-- =============================================================================
-- create_pdv_sale — equivalente a close_attendance() para venda avulsa de
-- produto (PDV). Mesma disciplina: SECURITY INVOKER (RLS é a barreira
-- real), tudo atômico, reaproveita adjust semantics de estoque via
-- stock_movement direto (mesmo padrão de close_attendance, não uma
-- segunda lógica), valida forma de pagamento contra payment_method, cria
-- financial_entry de receita. Nunca cria commission — não há profissional
-- nem serviço envolvido num item de PDV (seção "PDV — Comissão").
-- =============================================================================
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
security invoker
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
begin
  v_item_count := jsonb_array_length(coalesce(p_items, '[]'::jsonb));
  if v_item_count = 0 then
    raise exception 'VENDA_SEM_ITENS' using errcode = '22023';
  end if;

  if p_discount_amount < 0 or p_surcharge_amount < 0 then
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

  -- valida cada item (produto da empresa, estoque suficiente) e soma o subtotal antes de criar qualquer linha
  for v_item in select * from jsonb_array_elements(p_items) loop
    declare
      v_product_id uuid := (v_item->>'product_id')::uuid;
      v_quantity numeric := (v_item->>'quantity')::numeric;
      v_unit_price numeric := (v_item->>'unit_price')::numeric;
      v_discount numeric := coalesce((v_item->>'discount')::numeric, 0);
      v_current_stock numeric;
    begin
      if v_quantity is null or v_quantity <= 0 then
        raise exception 'QUANTIDADE_INVALIDA' using errcode = '22023';
      end if;

      select current_stock into v_current_stock
        from public.product
        where id = v_product_id and company_id = p_company_id and active;

      if v_current_stock is null then
        raise exception 'PRODUTO_INVALIDO' using errcode = '22023';
      end if;

      if v_current_stock < v_quantity then
        raise exception 'ESTOQUE_INSUFICIENTE' using errcode = '22023';
      end if;

      v_subtotal := v_subtotal + (v_unit_price * v_quantity - v_discount);
    end;
  end loop;

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
  values (p_company_id, p_unit_id, p_client_id, null, 'completed', v_subtotal, p_discount_amount, p_surcharge_amount, v_total, auth.uid())
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    declare
      v_product_id uuid := (v_item->>'product_id')::uuid;
      v_quantity numeric := (v_item->>'quantity')::numeric;
      v_unit_price numeric := (v_item->>'unit_price')::numeric;
      v_discount numeric := coalesce((v_item->>'discount')::numeric, 0);
      v_item_total numeric;
      v_alloc_ratio numeric;
      v_sale_item_id uuid;
    begin
      v_item_total := v_unit_price * v_quantity - v_discount;
      v_alloc_ratio := case when v_subtotal > 0 then v_item_total / v_subtotal else 0 end;
      v_item_total := round(v_item_total - (p_discount_amount * v_alloc_ratio) + (p_surcharge_amount * v_alloc_ratio), 2);

      insert into public.sale_item (sale_id, company_id, kind, product_id, quantity, unit_price, discount, total)
      values (v_sale_id, p_company_id, 'product', v_product_id, v_quantity, v_unit_price, v_discount, v_item_total)
      returning id into v_sale_item_id;

      insert into public.stock_movement (company_id, unit_id, item_type, product_id, movement_type, quantity, reference_type, reference_id, created_by)
      values (p_company_id, p_unit_id, 'product', v_product_id, 'sale', -v_quantity, 'sale_item', v_sale_item_id, auth.uid());

      update public.product set current_stock = current_stock - v_quantity where id = v_product_id;
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
      if v_amount <= 0 then
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
        insert into public.cash_movement (company_id, cash_session_id, type, amount, method, reference_type, reference_id, created_by)
        values (p_company_id, v_cash_session_id, 'sale_payment', v_amount, v_method, 'payment', v_payment_id, auth.uid());
      end if;

      insert into public.financial_entry (company_id, unit_id, type, category, description, amount, reference_type, reference_id, entry_date, created_by)
      values (p_company_id, p_unit_id, 'income', 'venda_pdv', 'Venda PDV', v_amount, 'payment', v_payment_id, current_date, auth.uid());
    end;
  end loop;

  perform public.write_audit_log(p_company_id, 'create_pdv_sale', 'sale', v_sale_id, null,
    jsonb_build_object('total', v_total, 'items', v_item_count));

  return v_sale_id;
end;
$$;

revoke all on function public.create_pdv_sale(uuid, uuid, uuid, jsonb, numeric, numeric, jsonb) from public;
grant execute on function public.create_pdv_sale(uuid, uuid, uuid, jsonb, numeric, numeric, jsonb) to authenticated;

-- Nova rota administrativa reservada (mesma lista em lib/slug.ts).
insert into public.reserved_slug (slug) values ('pdv') on conflict (slug) do nothing;
