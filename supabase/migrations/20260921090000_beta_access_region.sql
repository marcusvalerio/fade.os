-- P1.2 — a Landing pede "Nome / E-mail / Região / WhatsApp" no CTA de Beta.
-- O mecanismo já existe (beta_access_requests + submit_beta_access_request)
-- e continua sendo o único: isto só ACRESCENTA a região, nunca cria uma fila
-- paralela. barbershop_name e phone continuam existindo — já eram dado real
-- e aprovado, e phone já cumpria o papel de "WhatsApp" (só o rótulo na
-- interface muda).

alter table public.beta_access_requests
  add column region text;

comment on column public.beta_access_requests.region is
  'Região/cidade informada no pedido de acesso Beta — texto livre, opcional. Usado só para priorizar a expansão do Beta, nunca validado contra uma lista fechada.';

drop function if exists public.submit_beta_access_request(text, text, text, text);

create or replace function public.submit_beta_access_request(
  p_email text,
  p_name text,
  p_barbershop_name text,
  p_phone text default null,
  p_region text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := btrim(coalesce(p_name, ''));
  v_barbershop text := btrim(coalesce(p_barbershop_name, ''));
  v_id uuid;
begin
  if v_email = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'EMAIL_INVALIDO' using errcode = '22023';
  end if;
  if v_name = '' then
    raise exception 'NOME_OBRIGATORIO' using errcode = '22023';
  end if;
  if v_barbershop = '' then
    raise exception 'NOME_BARBEARIA_OBRIGATORIO' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.beta_access_requests
    where lower(btrim(email)) = v_email and status = 'pending'
  ) then
    raise exception 'SOLICITACAO_JA_EXISTE' using errcode = '23505';
  end if;

  insert into public.beta_access_requests (email, name, barbershop_name, phone, region)
  values (v_email, v_name, v_barbershop, nullif(btrim(p_phone), ''), nullif(btrim(p_region), ''))
  returning id into v_id;

  perform public.write_platform_audit_log(
    'beta_request_created', 'beta_access_request', v_id,
    null, jsonb_build_object('email', v_email, 'barbershop_name', v_barbershop), null
  );

  return v_id;
end;
$function$;

revoke all on function public.submit_beta_access_request(text, text, text, text, text) from public;
grant execute on function public.submit_beta_access_request(text, text, text, text, text) to anon, authenticated;
