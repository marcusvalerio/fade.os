-- FADE OS — Rodada de correção 02: integridade financeira.
--
-- Três defeitos comprovados no laboratório, todos com a mesma forma: a regra
-- financeira existia no meio de uma função, e bastava chegar por outra porta
-- para contorná-la.
--
--   1. PAGAMENTO ÓRFÃO. create_pdv_sale e close_attendance procuram a sessão
--      de caixa aberta com `select ... limit 1`. Sem caixa aberto o resultado
--      é NULL, e o código seguia: gravava payment com cash_session_id NULL e
--      pulava o cash_movement (guardado por `if v_cash_session_id is not
--      null`). Resultado medido na NORTE 21: 4 pagamentos em dinheiro,
--      R$ 178,00, confirmados e sem nenhum registro no caixa.
--
--   2. CAIXA FECHADO MUTÁVEL. cancel_sale lançava o estorno em
--      `v_payment.cash_session_id` — a sessão do pagamento original, mesmo
--      já encerrada. A sessão b565ee4c da NORTE 21 fechou com
--      expected_balance = 336,00 e hoje seus movimentos somam 318,00: a
--      fotografia histórica e o razão discordam em R$ 18,00.
--      Havia ainda dois caminhos diretos: addCashMovement insere em
--      cash_movement pelo PostgREST sem olhar o status da sessão, e
--      cash_session continuava com UPDATE e DELETE concedidos a
--      `authenticated` — um PATCH reabria uma sessão fechada.
--
--   3. CORRIDA. A busca da sessão não travava nada. Entre encontrar a sessão
--      aberta e inserir o pagamento, um fechamento concorrente podia entrar
--      no meio: ou o pagamento entrava numa sessão recém-fechada, ou o
--      fechamento somava sem enxergar o movimento que estava por vir.
--
-- A correção não fica nas funções: fica em trigger, no ponto onde a linha é
-- gravada. Assim vale para as RPCs, para o PostgREST direto e para qualquer
-- código futuro que ninguém lembrou de revisar.
--
-- Nada é apagado. Os registros legados de QA continuam onde estão, para
-- auditoria; o que muda é que novas operações não conseguem mais criá-los.

-- ---------------------------------------------------------------------------
-- 1. Movimento de caixa só entra em sessão aberta
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER porque precisa ler cash_session mesmo quando o RLS de quem
-- chama não alcançaria a linha — a checagem de empresa é feita aqui dentro.
--
-- `for no key update` é o que resolve a corrida: quem fecha o caixa pega o
-- mesmo lock. Se o movimento chega primeiro, o fechamento espera e depois
-- soma já contando com ele; se o fechamento chega primeiro, este select relê
-- a linha nova e encontra 'closed'.
create or replace function public.assert_cash_movement_session_open()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_company_id uuid;
begin
  select status, company_id into v_status, v_company_id
    from public.cash_session
    where id = new.cash_session_id
    for no key update;

  if v_status is null then
    raise exception 'CAIXA_NAO_ENCONTRADO' using errcode = 'P0002';
  end if;
  if v_company_id <> new.company_id then
    raise exception 'CAIXA_DE_OUTRA_EMPRESA' using errcode = '22023';
  end if;
  if v_status <> 'open' then
    raise exception 'CAIXA_FECHADO' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists cash_movement_requires_open_session on public.cash_movement;
create trigger cash_movement_requires_open_session
  before insert on public.cash_movement
  for each row execute function public.assert_cash_movement_session_open();

-- ---------------------------------------------------------------------------
-- 2. Pagamento em dinheiro exige caixa aberto
-- ---------------------------------------------------------------------------
-- Dinheiro é a única forma que entra fisicamente na gaveta, e por isso a
-- única que o caixa precisa registrar. Cartão e PIX guardam a sessão quando
-- há uma aberta — é informação útil de conferência de turno — mas não
-- dependem dela para existir.
--
-- "Crédito parcelado" continua sendo tratado como pagamento à vista, como
-- hoje: esta rodada não inventa parcela, recebível nem taxa.
create or replace function public.assert_payment_has_open_cash_session()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  if new.method <> 'cash' or new.status <> 'confirmed' then
    return new;
  end if;

  if new.cash_session_id is null then
    raise exception 'PAGAMENTO_SEM_CAIXA' using errcode = '22023';
  end if;

  select status into v_status
    from public.cash_session
    where id = new.cash_session_id and company_id = new.company_id
    for no key update;

  if v_status is distinct from 'open' then
    raise exception 'PAGAMENTO_SEM_CAIXA' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists payment_requires_open_cash_session on public.payment;
create trigger payment_requires_open_cash_session
  before insert on public.payment
  for each row execute function public.assert_payment_has_open_cash_session();

-- ---------------------------------------------------------------------------
-- 3. Sessão fechada é registro encerrado
-- ---------------------------------------------------------------------------
-- Vale inclusive para funções SECURITY DEFINER: depois que o caixa fecha,
-- nem uma correção bem-intencionada reescreve a fotografia.
create or replace function public.assert_cash_session_not_closed()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'CAIXA_IMUTAVEL' using errcode = '22023';
  end if;
  if old.status = 'closed' then
    raise exception 'CAIXA_FECHADO' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists cash_session_closed_is_immutable on public.cash_session;
create trigger cash_session_closed_is_immutable
  before update or delete on public.cash_session
  for each row execute function public.assert_cash_session_not_closed();

-- A porta direta do PostgREST some junto: nada na aplicação precisa alterar
-- cash_session fora de close_cash_session.
revoke update, delete on public.cash_session from authenticated, anon;
drop policy if exists cash_session_update on public.cash_session;

-- ---------------------------------------------------------------------------
-- 4. close_cash_session: trava antes de somar, e vira SECURITY DEFINER
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER porque o UPDATE que ela precisa fazer acabou de sair de
-- `authenticated`. A autorização não se perde — continua sendo "membro desta
-- empresa", o mesmo que o RLS garantia antes.
--
-- O lock passa a ser tomado ANTES da soma. Antes, um movimento que entrasse
-- entre o `select sum(...)` e o `update` ficava de fora do expected_balance e
-- a sessão nascia fechada já divergente.
create or replace function public.close_cash_session(
  p_cash_session_id uuid,
  p_counted_balance numeric,
  p_notes text default null
)
returns public.cash_session
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.cash_session;
  v_inflow numeric;
  v_outflow numeric;
  v_expected numeric;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into v_session
    from public.cash_session
    where id = p_cash_session_id
    for no key update;

  if v_session.id is null then
    raise exception 'SESSAO_NAO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if v_session.company_id not in (select public.my_company_ids()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_session.status <> 'open' then
    raise exception 'SESSAO_JA_FECHADA' using errcode = '22023';
  end if;
  if p_counted_balance is null or p_counted_balance < 0 then
    raise exception 'VALOR_INVALIDO' using errcode = '22023';
  end if;

  select coalesce(sum(amount), 0) into v_inflow
    from public.cash_movement
    where cash_session_id = p_cash_session_id and type in ('sale_payment', 'suprimento', 'other_in');

  select coalesce(sum(amount), 0) into v_outflow
    from public.cash_movement
    where cash_session_id = p_cash_session_id and type in ('sangria', 'other_out');

  v_expected := round(v_session.opening_balance + v_inflow - v_outflow, 2);

  update public.cash_session
    set status = 'closed', closed_by = auth.uid(), closed_at = now(),
        expected_balance = v_expected, counted_balance = p_counted_balance,
        difference = round(p_counted_balance - v_expected, 2), notes = p_notes
    where id = p_cash_session_id
    returning * into v_session;

  perform public.write_audit_log(
    v_session.company_id, 'close_cash_session', 'cash_session', p_cash_session_id, null,
    jsonb_build_object('expected', v_expected, 'counted', p_counted_balance,
                       'difference', v_session.difference, 'notes', p_notes)
  );

  return v_session;
end;
$$;

revoke all on function public.close_cash_session(uuid, numeric, text) from public, anon;
grant execute on function public.close_cash_session(uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Estorno é evento novo, não correção do passado
-- ---------------------------------------------------------------------------
-- Cancelar uma venda em dinheiro tira dinheiro da gaveta HOJE. Lançar essa
-- saída na sessão de ontem era reescrever um fato encerrado; lançar no caixa
-- aberto de agora é registrar o que de fato acontece.
--
-- E se não houver caixa aberto, a operação para: sem gaveta aberta não há de
-- onde tirar o dinheiro, e um estorno em dinheiro sem contrapartida no caixa
-- seria exatamente o pagamento órfão que esta migration existe para impedir.
-- Vendas pagas só em cartão ou PIX continuam podendo ser canceladas a
-- qualquer momento.
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

  -- Resolvido antes de qualquer escrita: ou o estorno inteiro acontece, ou
  -- o usuário recebe um "abra o caixa" com a venda intacta.
  select exists (
    select 1 from public.payment
    where sale_id = p_sale_id and status = 'confirmed' and method = 'cash'
  ) into v_has_cash;

  if v_has_cash then
    select cs.id into v_open_session_id
      from public.cash_session cs
      join public.cash_register cr on cr.id = cs.cash_register_id
      where cr.unit_id = v_sale.unit_id and cs.status = 'open'
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

    -- A saída vai para o caixa de agora, não para o do pagamento original.
    if v_payment.method = 'cash' then
      insert into public.cash_movement (
        company_id, cash_session_id, type, amount, method, reference_type, reference_id, reason, created_by
      )
      values (
        v_sale.company_id, v_open_session_id, 'other_out', v_payment.amount, v_payment.method,
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
    jsonb_build_object('status', v_sale.status),
    jsonb_build_object('status', 'cancelled', 'refund_cash_session_id', v_open_session_id),
    p_reason
  );
end;
$$;

revoke all on function public.cancel_sale(uuid, text) from public, anon;
grant execute on function public.cancel_sale(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Saber se há caixa aberto, para a interface avisar antes
-- ---------------------------------------------------------------------------
-- O backend é a garantia; isto existe só para o PDV e o Atendimento não
-- oferecerem "Dinheiro" quando não há gaveta aberta, em vez de deixar a
-- pessoa chegar até o fim e levar um erro.
create or replace function public.get_open_cash_session(p_unit_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select cs.id
  from public.cash_session cs
  join public.cash_register cr on cr.id = cs.cash_register_id
  where cr.unit_id = p_unit_id and cs.status = 'open'
  order by cs.opened_at desc
  limit 1;
$$;

revoke all on function public.get_open_cash_session(uuid) from public, anon;
grant execute on function public.get_open_cash_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Nota sobre sangria e suprimento
-- ---------------------------------------------------------------------------
-- Continuam existindo só como cash_movement, de propósito. Sangria não é
-- despesa e suprimento não é receita: é dinheiro trocando de lugar (gaveta ↔
-- cofre/banco). Lançá-los em financial_entry como income/expense inflaria as
-- duas colunas e distorceria o resultado. A visibilidade que faltava é de
-- apresentação, e está resolvida no Financeiro, em bloco próprio.
