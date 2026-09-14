-- P0.1: reverte get_professional_login_email() para @login.fade.os.
--
-- Causa raiz do bug "identificador ou senha incorretos": a migration
-- 20260920100000 (rebrand FADE->CORTEX) trocou esta função para gerar
-- @login.cortex.os, mas o código que CRIA a conta (actions/profissional-
-- acesso.ts, internalEmail()) só existe no commit 3667615, que está na
-- branch de trabalho e NUNCA foi promovido para main/produção. A produção
-- real (Vercel, deployment dpl_8tVK73yKGCVK2ZUZ7UdAWXeNA9XU, commit
-- ceb853f) continua rodando o código antigo, que grava auth.users.email
-- como <identificador>@login.fade.os. Com a função já trocada para
-- cortex.os, get_professional_login_email() passou a devolver um e-mail
-- que não existe em auth.users -> signInWithPassword falha -> "credenciais
-- inválidas" mapeado para "identificador ou senha incorretos".
--
-- Confirmado com o profissional 475Z8M ativado em produção às 03:30:42:
-- auth.users.email = 475z8m@login.fade.os (gravado pelo código antigo),
-- mas a função (antes desta correção) devolvia 475z8m@login.cortex.os.
--
-- Reverter aqui restaura a consistência com o que está de fato publicado.
-- Quando a promoção coordenada do rebrand para main acontecer, esta
-- função precisa ser trocada de volta para @login.cortex.os NO MESMO
-- deploy que leva actions/profissional-acesso.ts para produção -- nunca
-- uma sem a outra.
create or replace function public.get_professional_login_email(p_identifier text)
returns text
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select lower(pa.access_identifier) || '@login.fade.os'
  from public.professional_access pa
  where pa.access_identifier = upper(p_identifier) and pa.is_access_enabled
  limit 1;
$function$;
