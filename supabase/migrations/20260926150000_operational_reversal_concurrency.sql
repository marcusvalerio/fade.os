-- Serializa operações financeiras que possuem efeitos derivados.
-- Uma segunda requisição concorrente deve encontrar o registro já consumido,
-- sem repetir estoque, estorno, comissão, caixa ou auditoria.

create or replace function public.cancel_sale(p_sale_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale public.sale;
  v_item record;
  v_payment record;
  v_has_cash boolean;
  v_open_session_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  -- O lock precisa acontecer ANTES de qualquer efeito derivado.
  select * into v_sale
    from public.sale
   where id = p_sale_id
   for update;

  if v_sale.id is null then
    raise exception 'VENDA_NAO_ENCONTRADA' using errcode = 'P0002';
  end if;

  if not public.has_company_management_access(v_sale.company_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_sale.status = 'cancelled' then
    raise exception 'VENDA_JA_CANCELADA' using errcode = '22023';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'MOTIVO_OBRIGATORIO' using errcode = '22023';
  end if;

  select exists (
    select 1 from public.payment
     where sale_id = p_sale_id
       and status = 'confirmed'
       and method = 'cash'
  ) into v_has_cash;

  if v_has_cash then
    select cs.id into v_open_session_id
      from public.cash_session cs
      join public.cash_register cr on cr.id = cs.cash_register_id
     where cr.unit_id = v_sale.unit_id
       and cs.status = 'open'
     order by cs.opened_at desc
     limit 1;

    if v_open_session_id is null then
      raise exception 'ESTORNO_SEM_CAIXA' using errcode = '22023';
    end if;
  end if;

  for v_item in select * from public.sale_item where sale_id = p_sale_id loop
    if v_item.kind = 'product' and v_item.product_id is not null then
      perform public.apply_stock_delta(
        v_sale.company_id, v_sale.unit_id, 'product', v_item.product_id, v_item.quantity
      );

      insert into public.stock_movement (
        company_id, unit_id, item_type, product_id, movement_type, quantity,
        reference_type, reference_id, reason, created_by
      ) values (
        v_sale.company_id, v_sale.unit_id, 'product', v_item.product_id, 'adjustment', v_item.quantity,
        'sale_cancel', p_sale_id, 'Estorno de venda cancelada', auth.uid()
      );
    end if;

    update public.commission
       set status = 'reversed', reversed_at = now(), reversed_reason = p_reason
     where sale_item_id = v_item.id
       and status in ('predicted', 'due');
  end loop;

  for v_payment in
    select * from public.payment
     where sale_id = p_sale_id and status = 'confirmed'
  loop
    update public.payment
       set status = 'refunded', refunded_at = now(), refunded_reason = p_reason, refunded_by = auth.uid()
     where id = v_payment.id;

    if v_payment.method = 'cash' then
      insert into public.cash_movement (
        company_id, cash_session_id, type, amount, method, reference_type, reference_id, reason, created_by
      ) values (
        v_sale.company_id, v_open_session_id, 'other_out', v_payment.amount, v_payment.method,
        'payment_refund', v_payment.id, p_reason, auth.uid()
      );
    end if;

    insert into public.financial_entry (
      company_id, unit_id, type, category, description, amount,
      reference_type, reference_id, entry_date, created_by
    ) values (
      v_sale.company_id, v_sale.unit_id, 'expense', 'estorno', 'Estorno de pagamento', v_payment.amount,
      'payment_refund', v_payment.id, current_date, auth.uid()
    );
  end loop;

  update public.sale
     set status = 'cancelled', cancelled_at = now(), cancelled_reason = p_reason,
         cancelled_by = auth.uid(), updated_at = now()
   where id = p_sale_id;

  if v_sale.attendance_id is not null then
    update public.attendance
       set status = 'cancelled', updated_at = now()
     where id = v_sale.attendance_id and status = 'completed';
  end if;

  perform public.write_audit_log(
    v_sale.company_id, 'cancel_sale', 'sale', p_sale_id,
    jsonb_build_object('status', v_sale.status),
    jsonb_build_object('status', 'cancelled', 'refund_cash_session_id', v_open_session_id),
    p_reason
  );
end;
$$;

revoke all on function public.cancel_sale(uuid, text) from public, anon;
grant execute on function public.cancel_sale(uuid, text) to authenticated;

create or replace function public.mark_commission_paid(p_commission_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  -- Serializa a transição due -> paid e impede dois pagamentos concorrentes.
  select company_id, status into v_company_id, v_status
    from public.commission
   where id = p_commission_id
   for update;

  if v_company_id is null then
    raise exception 'COMISSAO_NAO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if not public.has_company_management_access(v_company_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_status <> 'due' then
    raise exception 'COMISSAO_NAO_DEVIDA' using errcode = '22023';
  end if;

  update public.commission
     set status = 'paid', paid_at = now(), paid_by = auth.uid()
   where id = p_commission_id
     and status = 'due';

  if not found then
    raise exception 'COMISSAO_NAO_DEVIDA' using errcode = '22023';
  end if;

  perform public.write_audit_log(
    v_company_id, 'mark_commission_paid', 'commission', p_commission_id,
    jsonb_build_object('status', v_status), jsonb_build_object('status', 'paid'), null
  );
end;
$$;

revoke all on function public.mark_commission_paid(uuid) from public, anon;
grant execute on function public.mark_commission_paid(uuid) to authenticated;
