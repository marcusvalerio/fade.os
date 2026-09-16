-- Impede novos clientes duplicados por telefone dentro da mesma empresa.
-- Não mescla dados existentes automaticamente: históricos de clientes são
-- operacionais e uma fusão cega poderia trocar agenda, vendas ou consentimento.
-- O lock transacional fecha também a janela de corrida entre duas criações.

create or replace function public.normalize_client_phone(p_phone text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
$$;

create index if not exists client_company_phone_normalized_idx
  on public.client (company_id, public.normalize_client_phone(phone));

create or replace function public.prevent_duplicate_client_phone()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text := public.normalize_client_phone(new.phone);
  v_existing uuid;
begin
  if v_phone is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(new.company_id::text || ':' || v_phone, 0)
  );

  select c.id into v_existing
    from public.client c
   where c.company_id = new.company_id
     and c.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
     and public.normalize_client_phone(c.phone) = v_phone
   limit 1;

  if v_existing is not null then
    raise exception 'CLIENTE_TELEFONE_DUPLICADO' using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_client_phone_dedup on public.client;
create trigger trg_client_phone_dedup
  before insert or update of company_id, phone on public.client
  for each row execute function public.prevent_duplicate_client_phone();

comment on function public.normalize_client_phone(text) is
  'Normaliza telefone de cliente para comparação operacional, mantendo apenas dígitos.';
