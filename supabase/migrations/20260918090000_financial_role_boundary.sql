-- FADE OS — R23.9: fronteira de papel nas tabelas financeiras.
--
-- PROBLEMA (P0, reproduzido contra o banco real antes da correção, em
-- transação revertida, com o dono rebaixado a `staff`):
--
--   financial_entry, commission, sale, sale_item e payment tinham RLS
--   escopado só por empresa (`company_id in my_company_ids()`), sem
--   checagem de papel. Medido:
--
--     SELECT como staff .... financial_entry=112 commission=38 sale=91
--                            sale_item=105 linhas — o razão inteiro da
--                            empresa, incluindo comissão de colegas.
--     INSERT financial_entry (fabricado, R$ 999.999) ......... SUCESSO
--     INSERT commission (fabricada, R$ 1.000) ................ SUCESSO
--     INSERT sale (fabricada, sem passar por create_pdv_sale) . SUCESSO
--
--   UPDATE/DELETE já estavam bloqueados por uma correção anterior
--   (revogação de grant, ver 20260913092000). O buraco era leitura e
--   inserção.
--
-- POR QUE NÃO BASTA "REVOGAR SELECT/INSERT PARA STAFF": create_pdv_sale e
-- close_attendance são SECURITY INVOKER — cada INSERT que fazem em sale,
-- sale_item, payment, cash_movement e financial_entry roda com a permissão
-- de quem chamou. É assim que um staff hoje legitimamente fecha uma venda.
-- Apertar a RLS sem tocar nessas funções quebraria a operação inteira.
--
-- CORREÇÃO, em duas partes:
--
--   1. create_pdv_sale e close_attendance viram SECURITY DEFINER, com uma
--      checagem explícita de vínculo (`user_company_role`) logo no início —
--      a mesma proteção que a RLS dava de graça no modo invoker, agora
--      escrita à mão, porque function SECURITY DEFINER não herda RLS do
--      dono da tabela. Sem essa checagem, virar DEFINER teria trocado um
--      buraco por outro (aceitar company_id/atendimento de qualquer
--      empresa). O resto da lógica das duas funções não muda uma linha.
--
--   2. RLS por papel em financial_entry, sale, sale_item, payment
--      (leitura e escrita: só has_company_management_access) e commission
--      (escrita: só gerência; leitura: gerência OU o próprio profissional —
--      é exatamente o filtro que /comissoes já aplica em código,
--      `getOwnProfessionalId`/`.eq("professional_id", ownProfessionalId)`;
--      agora o banco garante o mesmo, não só a página).
--
-- cash_movement e cash_session ficam de fora desta migration, de propósito:
-- addCashMovement (staff abre gaveta, faz sangria/suprimento) e
-- openCashSession escrevem direto nessas tabelas, como invoker, e são
-- operação diária legítima do staff. Restringir por papel quebraria o
-- caixa. Fica registrado como P1 residual (ver relatório da rodada):
-- staff pode inserir um cash_movement fabricado do tipo 'sale_payment' sem
-- venda por trás, via REST direto — bounded (não lê nem fabrica dado
-- financeiro fora do caixa), mas não é zero. Não corrigido aqui.

-- ---------------------------------------------------------------------------
-- 1. create_pdv_sale — SECURITY DEFINER + checagem de vínculo
-- ---------------------------------------------------------------------------
create or replace function public.create_pdv_sale(
  p_company_id uuid,
  p_unit_id uuid,
  p_client_id uuid default null::uuid,
  p_items jsonb default '[]'::jsonb,
  p_discount_amount numeric default 0,
  p_surcharge_amount numeric default 0,
  p_payments jsonb default '[]'::jsonb,
  p_authorization_code text default null::text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_subtotal numeric := 0; v_total numeric; v_sale_id uuid; v_item jsonb; v_item_count int;
  v_payment_sum numeric := 0; v_cash_session_id uuid; v_payment jsonb; v_price_changed boolean := false;
begin
  -- Vínculo explícito: em modo invoker isto vinha de graça da RLS de
  -- `sale`/`unit`. Em SECURITY DEFINER, sem esta linha, qualquer empresa
  -- passada em p_company_id seria aceita.
  if not exists (
    select 1 from public.user_company_role ucr
    where ucr.user_id = auth.uid() and ucr.company_id = p_company_id
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  v_item_count := jsonb_array_length(coalesce(p_items,'[]'::jsonb));
  if v_item_count = 0 then raise exception 'VENDA_SEM_ITENS' using errcode='22023'; end if;
  if p_discount_amount is null or p_surcharge_amount is null or p_discount_amount < 0 or p_surcharge_amount < 0 then
    raise exception 'VALOR_INVALIDO' using errcode='22023'; end if;
  if p_client_id is not null and not exists (select 1 from public.client c where c.id=p_client_id and c.company_id=p_company_id) then
    raise exception 'CLIENTE_INVALIDO' using errcode='22023'; end if;
  if not exists (select 1 from public.unit u where u.id=p_unit_id and u.company_id=p_company_id) then
    raise exception 'UNIDADE_INVALIDA' using errcode='22023'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    declare
      v_product_id uuid := (v_item->>'product_id')::uuid;
      v_quantity numeric := (v_item->>'quantity')::numeric;
      v_discount numeric := coalesce((v_item->>'discount')::numeric, 0);
      v_sale_price numeric; v_gross numeric;
    begin
      if v_quantity is null or v_quantity <= 0 then raise exception 'QUANTIDADE_INVALIDA' using errcode='22023'; end if;
      if v_discount < 0 then raise exception 'VALOR_INVALIDO' using errcode='22023'; end if;
      select sale_price into v_sale_price from public.product
        where id=v_product_id and company_id=p_company_id and unit_id=p_unit_id and active;
      if v_sale_price is null then raise exception 'PRODUTO_INVALIDO' using errcode='22023'; end if;
      v_gross := v_sale_price * v_quantity;
      if v_discount > v_gross then raise exception 'DESCONTO_MAIOR_QUE_SUBTOTAL' using errcode='22023'; end if;
      if v_discount > 0 then v_price_changed := true; end if;
      v_subtotal := v_subtotal + (v_gross - v_discount);
    end;
  end loop;

  if p_discount_amount > v_subtotal then raise exception 'DESCONTO_MAIOR_QUE_SUBTOTAL' using errcode='22023'; end if;
  if p_discount_amount > 0 or p_surcharge_amount > 0 then v_price_changed := true; end if;

  if v_price_changed then
    if p_authorization_code is not null then
      perform public.authorize_operation(p_company_id, p_authorization_code, 'discount');
    end if;
    perform public.assert_operation_authorized(p_company_id, 'discount');
  end if;

  v_total := round(v_subtotal - p_discount_amount + p_surcharge_amount, 2);

  select coalesce(sum((p->>'amount')::numeric),0) into v_payment_sum from jsonb_array_elements(coalesce(p_payments,'[]'::jsonb)) p;
  if jsonb_array_length(coalesce(p_payments,'[]'::jsonb)) = 0 then raise exception 'VENDA_SEM_PAGAMENTO' using errcode='22023'; end if;
  if abs(v_payment_sum - v_total) > 0.01 then raise exception 'PAGAMENTO_NAO_CONFERE' using errcode='22023'; end if;

  insert into public.sale (company_id, unit_id, client_id, attendance_id, status, subtotal, discount_amount, surcharge_amount, total, created_by)
  values (p_company_id, p_unit_id, p_client_id, null, 'completed', v_subtotal, p_discount_amount, p_surcharge_amount, v_total, auth.uid())
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    declare
      v_product_id uuid := (v_item->>'product_id')::uuid;
      v_quantity numeric := (v_item->>'quantity')::numeric;
      v_discount numeric := coalesce((v_item->>'discount')::numeric, 0);
      v_sale_price numeric; v_item_total numeric; v_alloc_ratio numeric; v_sale_item_id uuid;
    begin
      select sale_price into v_sale_price from public.product where id=v_product_id and company_id=p_company_id and unit_id=p_unit_id;
      v_item_total := v_sale_price * v_quantity - v_discount;
      v_alloc_ratio := case when v_subtotal > 0 then v_item_total / v_subtotal else 0 end;
      v_item_total := round(v_item_total - (p_discount_amount*v_alloc_ratio) + (p_surcharge_amount*v_alloc_ratio), 2);

      insert into public.sale_item (sale_id, company_id, kind, product_id, quantity, unit_price, discount, total)
      values (v_sale_id, p_company_id, 'product', v_product_id, v_quantity, v_sale_price, v_discount, v_item_total)
      returning id into v_sale_item_id;

      perform public.apply_stock_delta(p_company_id, p_unit_id, 'product', v_product_id, -v_quantity);

      insert into public.stock_movement (company_id, unit_id, item_type, product_id, movement_type, quantity, reference_type, reference_id, created_by)
      values (p_company_id, p_unit_id, 'product', v_product_id, 'sale', -v_quantity, 'sale_item', v_sale_item_id, auth.uid());
    end;
  end loop;

  select cs.id into v_cash_session_id from public.cash_session cs
    join public.cash_register cr on cr.id = cs.cash_register_id
    where cr.unit_id = p_unit_id and cs.status='open' order by cs.opened_at desc limit 1;

  for v_payment in select * from jsonb_array_elements(p_payments) loop
    declare v_method text := v_payment->>'method'; v_amount numeric := (v_payment->>'amount')::numeric; v_payment_id uuid;
    begin
      if v_amount is null or v_amount <= 0 then raise exception 'VALOR_PAGAMENTO_INVALIDO' using errcode='22023'; end if;
      if not exists (select 1 from public.payment_method pm where pm.company_id=p_company_id and pm.method=v_method and pm.active) then
        raise exception 'METODO_PAGAMENTO_INVALIDO' using errcode='22023'; end if;

      insert into public.payment (company_id, sale_id, method, amount, status, cash_session_id, created_by)
      values (p_company_id, v_sale_id, v_method, v_amount, 'confirmed', v_cash_session_id, auth.uid())
      returning id into v_payment_id;

      if v_cash_session_id is not null and v_method='cash' then
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
$function$;

-- ---------------------------------------------------------------------------
-- 2. close_attendance — SECURITY DEFINER + checagem de vínculo
-- ---------------------------------------------------------------------------
create or replace function public.close_attendance(
  p_attendance_id uuid,
  p_discount_amount numeric default 0,
  p_surcharge_amount numeric default 0,
  p_payments jsonb default '[]'::jsonb,
  p_authorization_code text default null::text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_attendance public.attendance; v_subtotal numeric := 0; v_total numeric; v_sale_id uuid;
  v_item record; v_alloc_ratio numeric; v_item_total numeric; v_sale_item_id uuid;
  v_commission_percent numeric; v_commission_amount numeric; v_cash_session_id uuid;
  v_payment jsonb; v_payment_sum numeric := 0; v_payment_count int; v_item_count int;
begin
  select * into v_attendance from public.attendance where id = p_attendance_id;
  if v_attendance.id is null then raise exception 'ATENDIMENTO_NAO_ENCONTRADO' using errcode='P0002'; end if;

  -- Vínculo explícito: sem esta linha, em modo DEFINER, qualquer
  -- p_attendance_id de qualquer empresa seria aceito — antes, em modo
  -- invoker, a própria RLS de `attendance` fechava isso de graça.
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

  perform public.write_audit_log(v_attendance.company_id, 'close_attendance', 'sale', v_sale_id, null,
    jsonb_build_object('total', v_total, 'discount_amount', p_discount_amount, 'surcharge_amount', p_surcharge_amount));
  return v_sale_id;
end;
$function$;

-- Os GRANTs de EXECUTE já existiam para `authenticated` (funções invoker
-- também precisam de EXECUTE); confirmando explicitamente, sem conceder a
-- anon.
revoke all on function public.create_pdv_sale(uuid, uuid, uuid, jsonb, numeric, numeric, jsonb, text) from public, anon;
grant execute on function public.create_pdv_sale(uuid, uuid, uuid, jsonb, numeric, numeric, jsonb, text) to authenticated;
revoke all on function public.close_attendance(uuid, numeric, numeric, jsonb, text) from public, anon;
grant execute on function public.close_attendance(uuid, numeric, numeric, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. RLS por papel: financial_entry, sale, sale_item, payment (gerência),
--    commission (gerência OU o próprio profissional)
-- ---------------------------------------------------------------------------
drop policy if exists financial_entry_select on public.financial_entry;
drop policy if exists financial_entry_insert on public.financial_entry;
create policy financial_entry_select on public.financial_entry for select to authenticated
  using (public.has_company_management_access(company_id));
create policy financial_entry_insert on public.financial_entry for insert to authenticated
  with check (public.has_company_management_access(company_id));

drop policy if exists sale_select on public.sale;
drop policy if exists sale_insert on public.sale;
create policy sale_select on public.sale for select to authenticated
  using (public.has_company_management_access(company_id));
create policy sale_insert on public.sale for insert to authenticated
  with check (public.has_company_management_access(company_id));

drop policy if exists sale_item_select on public.sale_item;
drop policy if exists sale_item_insert on public.sale_item;
create policy sale_item_select on public.sale_item for select to authenticated
  using (public.has_company_management_access(company_id));
create policy sale_item_insert on public.sale_item for insert to authenticated
  with check (public.has_company_management_access(company_id));

drop policy if exists payment_select on public.payment;
drop policy if exists payment_insert on public.payment;
create policy payment_select on public.payment for select to authenticated
  using (public.has_company_management_access(company_id));
create policy payment_insert on public.payment for insert to authenticated
  with check (public.has_company_management_access(company_id));

-- commission: leitura é gerência OU o próprio profissional — o mesmo filtro
-- que /comissoes já aplica em `getOwnProfessionalId`, agora também no banco.
drop policy if exists commission_select on public.commission;
drop policy if exists commission_insert on public.commission;
create policy commission_select on public.commission for select to authenticated
  using (
    public.has_company_management_access(company_id)
    or professional_id in (select id from public.professional where user_id = auth.uid())
  );
create policy commission_insert on public.commission for insert to authenticated
  with check (public.has_company_management_access(company_id));
