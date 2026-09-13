-- FADE OS — R24: fecha o residual do cash_movement (registrado na R23.9).
--
-- PROBLEMA (P1, reproduzido nesta rodada, transação revertida): um staff
-- inseria direto por REST um cash_movement do tipo 'sale_payment' — o
-- mesmo tipo que create_pdv_sale/close_attendance usam para registrar
-- dinheiro de venda de verdade — sem nenhuma venda por trás. Isso infla o
-- `expected_balance` calculado por close_cash_session (soma sale_payment +
-- suprimento + other_in), fazendo o caixa fechar com uma diferença que não
-- corresponde a nenhuma venda real: ou aparece uma sobra que não existe, ou
-- (mais grave) cobre uma sangria de dinheiro de verdade sem deixar rastro
-- de "falta" no fechamento.
--
-- 'sangria'/'suprimento'/'other_in'/'other_out' continuam abertos ao staff
-- direto — são a operação normal de caixa (addCashMovement já permite
-- exatamente esses quatro tipos pela Server Action). O que fecha aqui é só
-- 'sale_payment' fabricado fora das duas RPCs de venda.
--
-- MECANISMO: create_pdv_sale, close_attendance e cancel_sale já são
-- SECURITY DEFINER (dono `postgres`). Dentro delas, `current_user` deixa de
-- ser `authenticated` e passa a ser o dono da função — é assim que o
-- trigger abaixo distingue "este INSERT nasceu dentro de uma RPC de venda
-- confiável" de "este INSERT chegou direto por REST", sem precisar de outra
-- flag de sessão. Confirmado nesta rodada: current_user dentro de uma
-- função SECURITY DEFINER de dono `postgres` é `postgres`.
create or replace function public.enforce_cash_movement_origin()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.type = 'sale_payment' and current_user <> 'postgres' then
    if not public.has_company_management_access(new.company_id) then
      raise exception 'MOVIMENTO_SALE_PAYMENT_NAO_AUTORIZADO' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists cash_movement_sale_payment_origin on public.cash_movement;
create trigger cash_movement_sale_payment_origin
  before insert on public.cash_movement
  for each row execute function public.enforce_cash_movement_origin();
