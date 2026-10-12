-- Testes da sessão administrativa (20260930180000_admin_sessao.sql).
-- Rodar como postgres; termina com RAISE EXCEPTION — nada fica gravado.
-- Esperado:
--   MODO COMPATÍVEL (exigência desligada, estado ao aplicar a migration):
--     c_obrigatoria=false · c_a_valida=true · c_a_ativa=false · c_a_overview=ok ·
--     c_n_valida=false · c_n_overview=FORBIDDEN · c_is_admin_api=ok
--   MODO ESTRITO (depois de admin_exigir_sessao(true)):
--     e_ligar_sem_sessao=FORBIDDEN · e_abriu=true · e_ligou=true ·
--     e_outra_sessao=false · e_outra_overview=FORBIDDEN · e_outra_beta=0 ·
--     e_outra_notif_plat=0 · e_is_admin_api=42501 · e_logout=true ·
--     e_pos_logout=false · e_expirada=false · e_reaberta=true ·
--     e_abertas_pos_revogar=0 · e_revogado=false · e_n_abrir=null ·
--     e_n_aprovar=FORBIDDEN · e_n_beta=0 · e_anon=42501 ·
--     e_notificar_plataforma>=1 (identidade, sem sessão) · e_desligou=false ·
--     e_is_admin_api_desligado=ok · acoes com admin.login/logout/acesso_negado/exigir_sessao
do $$
declare
  a uuid := '31193062-0220-45c2-9097-dfacff9ea50d';  -- platform admin ativo
  n uuid := '99dd0037-b3d2-44dd-b0ad-eb0f8e0bf9bc';  -- dono de barbearia, não admin
  s1 uuid := gen_random_uuid();
  s2 uuid := gen_random_uuid();
  r text := '';
  v text;
  v_t timestamptz;
  v_n int;
  v_desde timestamptz := clock_timestamp();
begin
  -- ── modo compatível ──
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'session_id', s1, 'aal', 'aal1')::text, true);
  set local role authenticated;
  r := r || ' c_obrigatoria=' || public.admin_sessao_obrigatoria();
  r := r || ' c_a_valida=' || public.admin_sessao_valida();
  r := r || ' c_a_ativa=' || public.admin_sessao_ativa();
  begin perform public.admin_platform_overview(7); v := 'ok'; exception when others then v := sqlerrm; end;
  r := r || ' c_a_overview=' || v;
  begin perform public.is_platform_admin(a); v := 'ok'; exception when others then v := sqlstate; end;
  r := r || ' c_is_admin_api=' || v;
  begin perform public.admin_exigir_sessao(true); v := 'ok'; exception when others then v := sqlerrm; end;
  r := r || ' e_ligar_sem_sessao=' || v;
  perform set_config('request.jwt.claims', json_build_object('sub', n, 'role', 'authenticated', 'session_id', s1)::text, true);
  r := r || ' c_n_valida=' || public.admin_sessao_valida();
  begin perform public.admin_platform_overview(7); v := 'ok'; exception when others then v := sqlerrm; end;
  r := r || ' c_n_overview=' || v;

  -- ── liga a exigência ──
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'session_id', s1, 'aal', 'aal1')::text, true);
  v_t := public.admin_abrir_sessao();
  r := r || ' e_abriu=' || (v_t > now() + interval '7 hours 59 minutes');
  r := r || ' e_ligou=' || public.admin_exigir_sessao(true);

  -- outra sessão do Supabase (outro navegador) não herda
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'session_id', s2)::text, true);
  r := r || ' e_outra_sessao=' || public.admin_sessao_valida();
  begin perform public.admin_platform_overview(7); v := 'ok'; exception when others then v := sqlerrm; end;
  r := r || ' e_outra_overview=' || v;
  select count(*) into v_n from public.beta_access_requests; r := r || ' e_outra_beta=' || v_n;
  select count(*) into v_n from public.notificacao where publico = 'plataforma'; r := r || ' e_outra_notif_plat=' || v_n;
  begin perform public.is_platform_admin(n); v := 'ok'; exception when others then v := sqlstate; end;
  r := r || ' e_is_admin_api=' || v;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'session_id', s1)::text, true);
  select count(*) into v_n from public.beta_access_requests; r := r || ' e_beta_com_sessao=' || v_n;
  r := r || ' e_logout=' || public.admin_encerrar_sessao();
  r := r || ' e_pos_logout=' || public.admin_sessao_valida();

  perform public.admin_abrir_sessao();
  reset role;
  update public.platform_admin_sessao set expira_em = now() - interval '1 minute' where user_id = a and encerrada_em is null;
  set local role authenticated;
  r := r || ' e_expirada=' || public.admin_sessao_valida();

  perform public.admin_abrir_sessao();
  r := r || ' e_reaberta=' || public.admin_sessao_valida();
  reset role;
  update public.platform_admin set status = 'revoked' where user_id = a;
  select count(*) into v_n from public.platform_admin_sessao where user_id = a and encerrada_em is null;
  r := r || ' e_abertas_pos_revogar=' || v_n;
  set local role authenticated;
  r := r || ' e_revogado=' || public.admin_sessao_valida();
  reset role;
  update public.platform_admin set status = 'active' where user_id = a;

  perform set_config('request.jwt.claims', json_build_object('sub', n, 'role', 'authenticated', 'session_id', s1)::text, true);
  set local role authenticated;
  r := r || ' e_n_abrir=' || coalesce(public.admin_abrir_sessao()::text, 'null');
  begin perform public.approve_beta_access_request(gen_random_uuid(), null, 2); v := 'ok'; exception when others then v := sqlerrm; end;
  r := r || ' e_n_aprovar=' || v;
  select count(*) into v_n from public.beta_access_requests; r := r || ' e_n_beta=' || v_n;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  begin perform public.admin_sessao_valida(); v := 'ok'; exception when others then v := sqlstate; end;
  r := r || ' e_anon=' || v;
  reset role;

  select public.notificar_plataforma('plataforma.beta_aguardando', 'teste', 'teste', '/admin/acessos', '{}'::jsonb, 'teste:' || gen_random_uuid()) into v_n;
  r := r || ' e_notificar_plataforma=' || v_n;

  -- desliga de novo (volta ao modo compatível)
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'session_id', s1)::text, true);
  set local role authenticated;
  perform public.admin_abrir_sessao();
  r := r || ' e_desligou=' || public.admin_exigir_sessao(false);
  begin perform public.is_platform_admin(a); v := 'ok'; exception when others then v := sqlstate; end;
  r := r || ' e_is_admin_api_desligado=' || v;
  reset role;

  r := r || ' acoes=' || (select string_agg(action, ',') from public.platform_audit_log where action like 'admin.%' and created_at >= now());
  raise exception 'RESULTADO%', r;
end $$;
