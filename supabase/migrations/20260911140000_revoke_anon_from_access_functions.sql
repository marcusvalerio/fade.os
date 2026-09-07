-- FADE OS — FASE 10: tirar `anon` das funções de acesso profissional.
--
-- O `revoke ... from public` das migrations anteriores não bastou: o Supabase
-- concede EXECUTE a `anon` e `authenticated` por default privilege em tudo que
-- nasce no schema public, então a revogação precisa nomear o papel.
--
-- Na prática essas funções já falhavam para um anônimo (as três RPCs de gestão
-- levantam AUTH_REQUIRED quando auth.uid() é nulo), mas EXECUTE concedido ao
-- papel anônimo não tem justificativa nenhuma e aparece como alerta de
-- segurança no advisor do Supabase.
--
-- O que continua acessível a `anon`, de propósito:
--
--   - get_public_company / get_public_services / get_public_team /
--     get_public_professionals / get_public_available_slots /
--     create_public_appointment / get_public_appointment /
--     cancel_public_appointment — é a página pública de agendamento, que roda
--     sem sessão;
--   - get_professional_login_email — o login do profissional começa anônimo,
--     não existe auth.uid() ainda. Ela devolve só o e-mail sintético de um
--     acesso ativo e responde igual para código inexistente e código
--     desativado;
--   - my_company_ids e has_company_management_access — são usadas dentro das
--     policies de RLS, que são avaliadas com os privilégios de quem consulta.
--     Para um anônimo as duas retornam vazio/false.

do $$
declare
  v_fn text;
begin
  -- Gestão de acesso: exclusivas de owner/admin autenticado.
  for v_fn in
    select format('%s(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'enable_professional_access', 'disable_professional_access', 'reset_professional_access'
      )
  loop
    execute format('revoke all on function public.%s from anon', v_fn);
    execute format('grant execute on function public.%s to authenticated', v_fn);
  end loop;

  -- Geradores de credencial: ninguém chama de fora. As RPCs que os usam são
  -- SECURITY DEFINER, então a chamada aninhada roda com o privilégio do dono
  -- da função e não depende de quem chamou.
  for v_fn in
    select format('%s(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('generate_unique_access_identifier', 'generate_temporary_password')
  loop
    execute format('revoke all on function public.%s from anon, authenticated', v_fn);
  end loop;
end $$;
