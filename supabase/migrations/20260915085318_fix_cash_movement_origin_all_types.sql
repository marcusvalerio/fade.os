-- BETA HARDENING: cash movements must originate from trusted server-side flows.
-- The original protection covered only sale_payment. Supply/withdrawal and
-- other cash movement types must not be fabricable through direct REST/RLS.
create or replace function public.enforce_cash_movement_origin()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if current_user <> 'postgres' then
    if not public.has_company_management_access(new.company_id) then
      if new.type = 'sale_payment' then
        raise exception 'MOVIMENTO_SALE_PAYMENT_NAO_AUTORIZADO' using errcode = '42501';
      else
        raise exception 'MOVIMENTO_CASH_NAO_AUTORIZADO' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$function$;
