-- P0.7: close_attendance() marcava attendance.status='completed', mas nunca
-- tocava appointment.status quando o atendimento nasceu de um agendamento
-- (attendance.origin_appointment_id). São duas fontes de verdade
-- separadas — a Agenda lê appointment.status (via appointment_service ->
-- appointment), não attendance.status. Resultado: um atendimento fechado
-- (com venda, pagamento, comissão e baixa de estoque já gravados)
-- continuava aparecendo "Em atendimento" na Agenda indefinidamente, porque
-- o único UPDATE em appointment vinha de updateAppointmentStatus() —
-- nunca chamado pelo fechamento.
--
-- Fix: no mesmo bloco atômico de close_attendance(), se houver
-- origin_appointment_id, sincroniza appointment.status='completed'
-- também. Isso também dispara o Realtime que a Agenda já assina em
-- appointment/appointment_service (RealtimeRefresh), então telas abertas
-- atualizam sozinhas, sem depender só de revalidatePath.
create or replace function public.close_attendance(p_attendance_id uuid, p_discount_amount numeric DEFAULT 0, p_surcharge_amount numeric DEFAULT 0, p_payments jsonb DEFAULT '[]'::jsonb, p_authorization_code text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_attendance public.attendance; v_subtotal numeric := 0; v_total numeric; v_sale_id uuid;
  v_item record; v_alloc_ratio numeric; v_item_total numeric; v_sale_item_id uuid;
  v_commission_percent numeric; v_commission_amount numeric; v_cash_session_id uuid;
  v_payment jsonb; v_payment_sum numeric := 0; v_payment_count int; v_item_count int;
begin
  select * into v_attendance from public.attendance where id = p_attendance_id;
  if v_attendance.id is null then raise exception 'ATENDIMENTO_NAO_ENCONTRADO' using errcode='P0002'; end if;

  if not exists (
    select 1 from public.user_company_role ucr
    where ucr.user_id = auth.uid() and ucr.company_id = v_attendance.company_id
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_attendance.status <> 'in_progress' then raise exception 'ATENDIMENTO_JA_FECHADO' using errcode='22023'; end if;

  select count(*) into v_item_count from public.attendance_item where attendance_id = p_attendance_id;
  if v_item_count = 0 then raise exception 'ATENDIMENTO_SEM_ITENS' using errcode='22023'; end if;

  if p_discount_amount is null or p_surcharge_amount is null or p_discount_amount < 0 or p_surcharge_amount < 0 then
    raise exception 'VALOR_INVALIDO' using errcode='22023'; end if;

  select coalesce(sum(final_price),0) into v_subtotal from public.attendance_item where attendance_id = p_attendance_id;
  if p_discount_amount > v_subtotal then raise exception 'DESCONTO_MAIOR_QUE_SUBTOTAL' using errcode='22023'; end if;

  if p_discount_amount > 0 or p_surcharge_amount > 0 then
    if p_authorization_code is not null then
      perform public.authorize_operation(v_attendance.company_id, p_authorization_code, 'discount');
    end if;
    perform public.assert_operation_authorized(v_attendance.company_id, 'discount');
  end if;

  v_total := round(v_subtotal - p_discount_amount + p_surcharge_amount, 2);
  v_payment_count := jsonb_array_length(coalesce(p_payments,'[]'::jsonb));
  select coalesce(sum((p->>'amount')::numeric),0) into v_payment_sum from jsonb_array_elements(coalesce(p_payments,'[]'::jsonb)) p;

  if v_total > 0 then
    if v_payment_count = 0 then raise exception 'VENDA_SEM_PAGAMENTO' using errcode='22023'; end if;
    if abs(v_payment_sum - v_total) > 0.01 then raise exception 'PAGAMENTO_NAO_CONFERE' using errcode='22023'; end if;
  elsif v_payment_count > 0 then
    raise exception 'PAGAMENTO_NAO_CONFERE' using errcode='22023';
  end if;

  insert into public.sale (company_id, unit_id, client_id, attendance_id, status, subtotal, discount_amount, surcharge_amount, total, created_by)
  values (v_attendance.company_id, v_attendance.unit_id, v_attendance.client_id, p_attendance_id, 'completed',
          v_subtotal, p_discount_amount, p_surcharge_amount, v_total, auth.uid())
  returning id into v_sale_id;

  for v_item in select * from public.attendance_item where attendance_id = p_attendance_id loop
    v_alloc_ratio := case when v_subtotal > 0 then v_item.final_price / v_subtotal else 0 end;
    v_item_total := round(v_item.final_price - (p_discount_amount*v_alloc_ratio) + (p_surcharge_amount*v_alloc_ratio), 2);

    insert into public.sale_item (sale_id, company_id, kind, service_id, product_id, attendance_item_id, professional_id,
      quantity, unit_price, discount, is_courtesy, total)
    values (v_sale_id, v_attendance.company_id, v_item.kind, v_item.service_id, v_item.product_id, v_item.id, v_item.professional_id,
      coalesce(v_item.quantity,1), v_item.original_price, v_item.discount, v_item.type = 'courtesy', v_item_total)
    returning id into v_sale_item_id;

    if v_item.kind='service' and v_item.professional_id is not null then
      select coalesce((select default_commission_percent from public.service where id=v_item.service_id),
                      (select default_commission_percent from public.professional where id=v_item.professional_id), 0)
        into v_commission_percent;
      v_commission_amount := round(v_item_total * v_commission_percent / 100, 2);
      insert into public.commission (company_id, sale_item_id, professional_id, base_amount, percent, amount, status)
      values (v_attendance.company_id, v_sale_item_id, v_item.professional_id, v_item_total, v_commission_percent, v_commission_amount, 'due');
      update public.attendance_item set commission_percent_snapshot = v_commission_percent, commission_amount = v_commission_amount where id = v_item.id;
    end if;

    if v_item.kind='product' and v_item.product_id is not null then
      perform public.apply_stock_delta(v_attendance.company_id, v_attendance.unit_id, 'product', v_item.product_id, -coalesce(v_item.quantity,1));
      insert into public.stock_movement (company_id, unit_id, item_type, product_id, movement_type, quantity, reference_type, reference_id, created_by)
      values (v_attendance.company_id, v_attendance.unit_id, 'product', v_item.product_id, 'sale', -coalesce(v_item.quantity,1), 'sale_item', v_sale_item_id, auth.uid());
    end if;
  end loop;

  select cs.id into v_cash_session_id from public.cash_session cs
    join public.cash_register cr on cr.id = cs.cash_register_id
    where cr.unit_id = v_attendance.unit_id and cs.status='open' order by cs.opened_at desc limit 1;

  for v_payment in select * from jsonb_array_elements(coalesce(p_payments,'[]'::jsonb)) loop
    declare v_method text := v_payment->>'method'; v_amount numeric := (v_payment->>'amount')::numeric; v_payment_id uuid;
    begin
      if v_amount is null or v_amount <= 0 then raise exception 'VALOR_PAGAMENTO_INVALIDO' using errcode='22023'; end if;
      if not exists (select 1 from public.payment_method pm where pm.company_id=v_attendance.company_id and pm.method=v_method and pm.active) then
        raise exception 'METODO_PAGAMENTO_INVALIDO' using errcode='22023'; end if;

      insert into public.payment (company_id, sale_id, method, amount, status, cash_session_id, created_by)
      values (v_attendance.company_id, v_sale_id, v_method, v_amount, 'confirmed', v_cash_session_id, auth.uid())
      returning id into v_payment_id;

      if v_cash_session_id is not null and v_method='cash' then
        insert into public.cash_movement (company_id, cash_session_id, type, amount, method, reference_type, reference_id, created_by)
        values (v_attendance.company_id, v_cash_session_id, 'sale_payment', v_amount, v_method, 'payment', v_payment_id, auth.uid());
      end if;

      insert into public.financial_entry (company_id, unit_id, type, category, description, amount, reference_type, reference_id, entry_date, created_by)
      values (v_attendance.company_id, v_attendance.unit_id, 'income', 'venda', 'Pagamento de venda', v_amount, 'payment', v_payment_id, current_date, auth.uid());
    end;
  end loop;

  update public.attendance set status='completed', updated_at=now() where id = p_attendance_id;

  -- P0.7: sem isso, a Agenda (que lê appointment.status, não
  -- attendance.status) nunca soube que este atendimento terminou.
  if v_attendance.origin_appointment_id is not null then
    update public.appointment
      set status = 'completed', updated_at = now()
      where id = v_attendance.origin_appointment_id
        and status <> 'completed';
  end if;

  perform public.write_audit_log(v_attendance.company_id, 'close_attendance', 'sale', v_sale_id, null,
    jsonb_build_object('total', v_total, 'discount_amount', p_discount_amount, 'surcharge_amount', p_surcharge_amount));
  return v_sale_id;
end;
$function$;
