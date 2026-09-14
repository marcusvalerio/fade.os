-- Rebrand FADE.OS -> CORTEX.OS: domínio do e-mail sintético de login por
-- identificador. Só troca a string que get_professional_login_email()
-- monta (@login.fade.os -> @login.cortex.os) — não mexe em nenhuma linha
-- de auth.users nem de professional_access.
--
-- Seguro hoje porque não há dado real dependendo do valor antigo: zero
-- linhas em professional_access e zero contas @login.fade.os em
-- auth.users no momento desta migration (verificado antes de escrever
-- esta migration). Se isso deixar de ser verdade no futuro, trocar esta
-- função sozinha quebraria o login de quem já tem conta com o domínio
-- antigo — nesse cenário a migração precisaria também atualizar
-- auth.users.email das contas existentes, no mesmo commit.
create or replace function public.get_professional_login_email(p_identifier text)
returns text
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select lower(pa.access_identifier) || '@login.cortex.os'
  from public.professional_access pa
  where pa.access_identifier = upper(p_identifier) and pa.is_access_enabled
  limit 1;
$function$;
