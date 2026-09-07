-- FADE OS — FASE 10: autorização dentro das RPCs sensíveis.
--
-- A FASE 3 colocou requireCompanyManager nas Server Actions administrativas.
-- Isso fecha o caminho pela aplicação, mas não é o único caminho: o PostgREST
-- expõe /rest/v1/rpc/<função> para qualquer portador de um JWT válido. Um
-- profissional com papel `staff` tem exatamente isso, e as funções abaixo são
-- SECURITY INVOKER — o RLS deixa passar, porque ele É da empresa.
--
-- Ou seja: o gate em TypeScript era contornável com uma chamada HTTP direta.
-- Mesmo raciocínio de "esconder o link não protege a action", um nível abaixo.
--
-- Regra aplicada: quem decide autoridade (ajuste de estoque, cancelamento de
-- venda, endereço público da barbearia) checa o papel dentro da própria
-- função. O que é operação do dia a dia (venda, atendimento, agendamento,
-- caixa) continua aberto a qualquer vínculo, protegido por RLS.

-- ---------------------------------------------------------------------------
-- 1. Ajuste de estoque exige owner/admin
-- ---------------------------------------------------------------------------
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
  if not public.has_company_management_access(p_company_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
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
-- 2. Cancelamento de venda exige owner/admin
-- ---------------------------------------------------------------------------
-- Cancelar move dinheiro (estorno), estoque, comissão e caixa de uma vez. Só
-- o corpo muda em relação à migration anterior: entra a checagem de papel logo
-- depois de carregar a venda, que é de onde sai o company_id.
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

  if not public.has_company_management_access(v_sale.company_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
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

-- ---------------------------------------------------------------------------
-- 3. Endereço público da barbearia exige owner/admin
-- ---------------------------------------------------------------------------
-- Esta é SECURITY DEFINER: passa por cima do RLS. A verificação de vínculo que
-- ela já tinha aceitava qualquer papel, então qualquer profissional podia
-- trocar o endereço público da barbearia — e quebrar todos os links já
-- divulgados.
create or replace function public.set_company_slug(
  p_company_id uuid,
  p_desired_slug text default null,
  p_auto_suffix boolean default true
)
returns public.company
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_base text;
  v_candidate text;
  v_company public.company;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if not public.has_company_management_access(p_company_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_company from public.company where id = p_company_id;
  if not found then
    raise exception 'COMPANY_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_base := coalesce(p_desired_slug, v_company.name);
  v_candidate := public.generate_available_company_slug(v_base, p_company_id);

  if not p_auto_suffix and v_candidate <> coalesce(public.slugify(v_base), 'barbearia') then
    raise exception 'SLUG_INDISPONIVEL' using errcode = '23505';
  end if;

  update public.company set slug = v_candidate, updated_at = now()
  where id = p_company_id
  returning * into v_company;

  return v_company;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Tirar `anon` de tudo que é operação interna
-- ---------------------------------------------------------------------------
-- Herança do grant implícito a PUBLIC, nunca revogado. Na prática o RLS já
-- barrava (um anônimo não tem vínculo em my_company_ids), e as SECURITY
-- DEFINER checam auth.uid() — mas não há motivo nenhum para o papel anônimo
-- carregar EXECUTE nessas funções. A camada pública de agendamento tem as
-- suas próprias funções get_public_*/create_public_appointment e não é
-- afetada.
do $$
declare
  v_fn text;
  v_names text[] := array[
    'adjust_stock', 'apply_stock_delta', 'assert_can_change_price', 'assert_appointment_slot_valid',
    'cancel_sale', 'close_attendance', 'close_cash_session', 'create_internal_appointment',
    'create_pdv_sale', 'get_available_slots', 'get_dashboard_metrics', 'open_cash_session',
    'set_company_slug', 'write_audit_log', 'generate_available_company_slug'
  ];
begin
  for v_fn in
    select format('%s(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(v_names)
  loop
    execute format('revoke all on function public.%s from anon', v_fn);
    execute format('grant execute on function public.%s to authenticated', v_fn);
  end loop;
end $$;
