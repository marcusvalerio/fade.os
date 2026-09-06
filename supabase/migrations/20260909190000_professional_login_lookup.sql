-- FADE OS — BLOCO B: lookup público controlado do identificador profissional
-- O login começa sem sessão, então não pode consultar professional_access via RLS.
-- Esta RPC expõe somente o e-mail técnico de um acesso ativo e não retorna
-- senha, hash, empresa ou qualquer outro dado do profissional.
create or replace function public.get_professional_login_email(p_identifier text)
returns text
language sql
security definer
set search_path = public, pg_temp
as $$
  select lower(pa.access_identifier) || '@login.fade.os'
  from public.professional_access pa
  where upper(pa.access_identifier) = upper(p_identifier)
    and pa.is_access_enabled = true
  limit 1;
$$;

revoke all on function public.get_professional_login_email(text) from public;
grant execute on function public.get_professional_login_email(text) to anon, authenticated;
