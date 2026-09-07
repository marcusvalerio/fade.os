-- FADE OS — Auditoria final: registro financeiro imutável para o cliente.
--
-- PROBLEMA (P1, comprovado): sale, sale_item, payment, commission,
-- financial_entry, cash_movement e stock_movement tinham UPDATE e DELETE
-- concedidos a `authenticated`, com policy de UPDATE escopada apenas por
-- empresa. Ou seja, qualquer membro da barbearia — inclusive `staff` — podia
-- reescrever o valor de uma venda JÁ FECHADA com um PATCH direto no
-- PostgREST:
--
--   update sale_item set total = 1, unit_price = 1 where sale_id = ...
--
-- Medido: 1 linha alterada. Fechar a venda corretamente não adiantava, porque
-- o registro continuava editável depois.
--
-- Nada na aplicação precisa desse UPDATE: quem escreve nessas tabelas são as
-- funções de venda (só INSERT) e cancel_sale / markCommissionPaid. Então o
-- caminho é fechar a porta e levar as duas exceções para funções.
--
-- Não é destrutivo: nenhuma linha é alterada, só privilégios e policies.

-- ---------------------------------------------------------------------------
-- 1. cancel_sale passa a ser SECURITY DEFINER
-- ---------------------------------------------------------------------------
-- Ela precisa atualizar sale, payment e commission, e é justamente esse UPDATE
-- que estamos tirando de `authenticated`. Dependia do RLS para o isolamento
-- de tenant, e isso não se perde: a função já carrega a venda e checa
-- has_company_management_access(company_id) logo em seguida — um usuário de
-- outra empresa recebe FORBIDDEN, e um staff da própria empresa também.
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
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into v_sale from public.sale where id = p_sale_id;
  if v_sale.id is null then
    raise exception 'VENDA_NAO_ENCONTRADA' using errcode = 'P0002';
  end if;

  -- Cobre papel E empresa numa checagem só: quem não é owner/admin DESTA
  -- empresa não passa.
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

revoke all on function public.cancel_sale(uuid, text) from public, anon;
grant execute on function public.cancel_sale(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Pagamento de comissão vira função
-- ---------------------------------------------------------------------------
-- Era a única outra escrita legítima em `commission` vinda da aplicação, feita
-- por UPDATE direto na Server Action. Vira RPC pelo mesmo motivo de sempre: o
-- gate precisa estar onde a chamada direta também bate.
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

  select company_id, status into v_company_id, v_status
    from public.commission where id = p_commission_id;

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
    where id = p_commission_id;

  perform public.write_audit_log(
    v_company_id, 'mark_commission_paid', 'commission', p_commission_id,
    jsonb_build_object('status', v_status), jsonb_build_object('status', 'paid'), null
  );
end;
$$;

revoke all on function public.mark_commission_paid(uuid) from public, anon;
grant execute on function public.mark_commission_paid(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Fechar a escrita direta no razão financeiro
-- ---------------------------------------------------------------------------
-- INSERT continua: é assim que close_attendance e create_pdv_sale (SECURITY
-- INVOKER) registram a venda. O que sai é o poder de reescrever ou apagar o
-- que já foi registrado.
do $$
declare
  v_table text;
  v_tables text[] := array[
    'sale', 'sale_item', 'payment', 'commission',
    'financial_entry', 'cash_movement', 'stock_movement'
  ];
begin
  foreach v_table in array v_tables loop
    execute format('revoke update, delete on public.%I from authenticated, anon', v_table);
    -- A policy de UPDATE deixa de ter efeito sem o grant; removê-la evita ler
    -- o schema e concluir que a escrita é permitida.
    execute format('drop policy if exists %I on public.%I', v_table || '_update', v_table);
  end loop;
end $$;
