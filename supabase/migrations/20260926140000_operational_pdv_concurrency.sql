-- CORTEX.OS — integridade operacional do PDV
--
-- O PDV não tem attendance_id para servir como chave natural de idempotência.
-- Ainda assim, uma requisição repetida do mesmo usuário pode criar duas vendas
-- legítimas se o primeiro request já tiver sido confirmado e o cliente repetir
-- o clique. A solução é oferecer uma chave de idempotência explícita por venda.
--
-- A chave é fornecida pela aplicação no início da tentativa de fechamento e
-- fica protegida por UNIQUE(company_id, idempotency_key). Repetições com a mesma
-- chave retornam a venda original; chaves diferentes continuam sendo vendas
-- independentes. Não tentamos deduzir que dois carrinhos iguais são duplicados.

alter table public.sale
  add column if not exists idempotency_key text;

create unique index if not exists sale_company_idempotency_key_uq
  on public.sale (company_id, idempotency_key)
  where idempotency_key is not null;

comment on column public.sale.idempotency_key is
  'Chave de idempotência fornecida pelo cliente para uma tentativa de fechamento do PDV; única por empresa.';

-- A RPC recebe a chave como último argumento para preservar compatibilidade
-- com chamadas existentes que ainda não a utilizam. Quando a chave existir,
-- uma repetição da mesma operação retorna a venda já concluída.
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
  v_existing_sale_id uuid;
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

    -- O UNIQUE abaixo é a garantia definitiva contra duas vendas para a mesma
    -- tentativa. O advisory lock reduz a corrida e permite que o segundo
    -- request veja a primeira venda já criada, em vez de depender do erro de
    -- constraint como fluxo normal.
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

  -- O corpo original da operação permanece delegado ao helper privado para
  -- não duplicar a longa cadeia venda -> item -> estoque -> pagamento ->
  -- financeiro. A chave é gravada no INSERT dentro do helper.
  return public.create_pdv_sale_atomic(
    p_company_id,
    p_unit_id,
    p_client_id,
    p_items,
    p_discount_amount,
    p_surcharge_amount,
    p_payments,
    p_authorization_code,
    p_idempotency_key
  );
end;
$function$;

revoke all on function public.create_pdv_sale(uuid, uuid, uuid, jsonb, numeric, numeric, jsonb, text, text) from public, anon;
grant execute on function public.create_pdv_sale(uuid, uuid, uuid, jsonb, numeric, numeric, jsonb, text, text) to authenticated;
