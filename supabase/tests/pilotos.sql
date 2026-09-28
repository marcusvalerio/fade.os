-- Testes do acompanhamento de pilotos (20260930160000_pilotos.sql).
--
-- Rodar no SQL Editor (ou pelo MCP) como postgres. Tudo acontece dentro de
-- um bloco que termina com RAISE EXCEPTION — a transação é desfeita e nada
-- fica gravado. O resultado vem na mensagem de erro "RESULTADO ...".
--
-- Esperado:
--   dados_operacionais_iguais=true · escritas_fora_do_piloto=0 ·
--   metricas_stable=s · snapshots_depois = snapshots_antes (ou 1 no Dia 0) · atividade_dup=0 ·
--   dup/passado/longo recusados · regrava_final=false/true ·
--   paridade_modulos=true/true · vendas=X/X (mesmo número) ·
--   soma_horas = ops · g_* = FORBIDDEN · auth_*/anon_* = negado
--
-- Ajuste os ids se o ambiente for outro (a1 = platform_admin ativo; g = um
-- dono de barbearia que não é admin; beta = outra empresa ativa sem piloto).
do $$
declare
  n21 uuid := 'fc0b2c5d-26bd-496d-bbf0-1a330ccc9a48';
  beta uuid := '7c19e075-7cf6-4017-96d2-5c9bc49d25bb';
  a1 uuid := '31193062-0220-45c2-9097-dfacff9ea50d';
  g uuid := '99dd0037-b3d2-44dd-b0ad-eb0f8e0bf9bc';
  r text := '';
  v_antes text; v_depois text; v_p uuid; v_p2 uuid; v_n int; v_m jsonb; v_uso jsonb; v_matriz jsonb; v_escritas bigint;
begin
  -- impressão digital de tudo o que é operacional da empresa
  select md5(concat_ws('|',
    (select string_agg(t::text, ',' order by t.id) from public.appointment t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.appointment_service t join public.appointment a on a.id = t.appointment_id where a.company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.attendance t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.attendance_item t join public.attendance a on a.id = t.attendance_id where a.company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.sale t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.payment t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.cash_session t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.commission t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.stock_movement t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.product t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.client t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.professional t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.financial_entry t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.audit_log t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.user_company_role t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.company t where id = n21),
    (select string_agg(t.id::text || coalesce(t.last_sign_in_at::text, ''), ',' order by t.id) from auth.users t where id in (select user_id from public.piloto_usuarios(n21))),
    (select string_agg(t.id::text || t.updated_at::text || coalesce(t.refreshed_at::text, ''), ',' order by t.id) from auth.sessions t where user_id in (select user_id from public.piloto_usuarios(n21)))
  )) into v_antes;

  -- criação pelo Admin (auditada) + Dia 0
  perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true);
  -- usa o piloto aberto da empresa, se já existir (ex.: o Piloto Norte 21 real)
  select id into v_p from public.piloto where company_id = n21 and status in ('planejado', 'ativo');
  if v_p is null then
    v_p := public.admin_criar_piloto(n21, 'Piloto de teste', public.piloto_hoje() + 1, 14, 'teste');
  end if;
  r := r || ' criado=' || (select status || ' ' || inicio || '..' || fim from public.piloto where id = v_p);
  r := r || ' dia0=' || (select string_agg(dia || '/d' || dia_do_piloto || '/final=' || final, ',') from public.piloto_snapshot where piloto_id = v_p);
  r := r || ' auditoria=' || (select count(*) from public.platform_audit_log where entity_id = v_p and action = 'pilot_created');
  r := r || ' snapshots_antes=' || (select count(*) from public.piloto_snapshot where piloto_id = v_p);

  -- idempotência
  perform public.piloto_coletar(); perform public.piloto_coletar();
  perform public.admin_capturar_piloto(v_p); perform public.admin_capturar_piloto(v_p);
  r := r || ' snapshots_depois=' || (select count(*) from public.piloto_snapshot where piloto_id = v_p);
  r := r || ' atividade_dup=' || (select count(*) - count(distinct (user_id, hora)) from public.piloto_atividade where piloto_id = v_p);

  -- regras
  begin perform public.admin_criar_piloto(n21, 'Outro', public.piloto_hoje() + 2); r := r || ' dup=ACEITOU'; exception when others then r := r || ' dup=' || sqlerrm; end;
  begin perform public.admin_criar_piloto(beta, 'Passado', public.piloto_hoje() - 10); r := r || ' passado=ACEITOU'; exception when others then r := r || ' passado=' || sqlerrm; end;
  begin perform public.admin_criar_piloto(beta, 'Longo', public.piloto_hoje(), 120); r := r || ' longo=ACEITOU'; exception when others then r := r || ' longo=' || sqlerrm; end;

  -- fechamento: piloto que começa hoje fecha o Dia 0 (ontem) e nasce ativo
  v_p2 := public.admin_criar_piloto(beta, 'Piloto teste 2', public.piloto_hoje(), 3);
  v_n := public.piloto_fechar_dias();
  r := r || ' fechou=' || v_n || ' p2=' || (select status from public.piloto where id = v_p2)
         || ' p2dia0=' || (select string_agg(dia || '/d' || dia_do_piloto || '/final=' || final || '/atrasado=' || atrasado, ',') from public.piloto_snapshot where piloto_id = v_p2);
  r := r || ' regrava_final=' || public.piloto_gravar_snapshot(v_p2, public.piloto_hoje() - 1, false)
         || '/' || (select final from public.piloto_snapshot where piloto_id = v_p2 and dia = public.piloto_hoje() - 1);
  perform public.admin_encerrar_piloto(v_p2, 'teste de encerramento', true);
  r := r || ' encerrado=' || (select status from public.piloto where id = v_p2)
         || ' audit_enc=' || (select count(*) from public.platform_audit_log where entity_id = v_p2 and action = 'pilot_cancelled');

  -- somente leitura: nenhuma escrita fora das tabelas do piloto e da auditoria da plataforma
  select coalesce(sum(n_tup_ins + n_tup_upd + n_tup_del), 0) into v_escritas from pg_stat_xact_user_tables
   where schemaname in ('public', 'auth') and relname not in ('piloto', 'piloto_snapshot', 'piloto_atividade', 'platform_audit_log');
  r := r || ' escritas_fora_do_piloto=' || v_escritas;
  r := r || ' metricas_stable=' || (select provolatile::text from pg_proc where proname = 'piloto_metricas');

  -- paridade de módulos com admin_matriz_de_uso
  v_uso := public.uso_por_modulo(n21, now() - interval '30 days', now() + interval '1 second');
  select uso into v_matriz from public.admin_matriz_de_uso(30) where company_id = n21;
  r := r || ' paridade_modulos=' || (v_uso = v_matriz);
  v_uso := public.uso_por_modulo(n21, now() - interval '90 days', now() + interval '1 second');
  select uso into v_matriz from public.admin_matriz_de_uso(90) where company_id = n21;
  r := r || '/' || (v_uso = v_matriz);

  -- consistência de um dia com operação real (14/09/2026 na Norte 21)
  v_m := public.piloto_metricas(n21, date '2026-09-14');
  r := r || ' d14: ops=' || (v_m ->> 'operacoes') || ' soma_horas=' || (select sum(value::int) from jsonb_array_elements_text(v_m -> 'horas'))
         || ' vendas=' || (v_m #>> '{vendas,concluidas}') || '/' || (select count(*) from public.sale where company_id = n21 and status = 'completed'
               and created_at >= timestamp '2026-09-14' at time zone 'America/Sao_Paulo' and created_at < timestamp '2026-09-15' at time zone 'America/Sao_Paulo')
         || ' valor=' || (v_m #>> '{vendas,valor}') || ' ativos=' || (v_m #>> '{usuarios,ativos}') || ' modulos=' || (v_m ->> 'modulos_usados')
         || ' horas_len=' || jsonb_array_length(v_m -> 'horas');

  select md5(concat_ws('|',
    (select string_agg(t::text, ',' order by t.id) from public.appointment t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.appointment_service t join public.appointment a on a.id = t.appointment_id where a.company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.attendance t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.attendance_item t join public.attendance a on a.id = t.attendance_id where a.company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.sale t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.payment t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.cash_session t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.commission t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.stock_movement t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.product t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.client t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.professional t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.financial_entry t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.audit_log t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.user_company_role t where company_id = n21),
    (select string_agg(t::text, ',' order by t.id) from public.company t where id = n21),
    (select string_agg(t.id::text || coalesce(t.last_sign_in_at::text, ''), ',' order by t.id) from auth.users t where id in (select user_id from public.piloto_usuarios(n21))),
    (select string_agg(t.id::text || t.updated_at::text || coalesce(t.refreshed_at::text, ''), ',' order by t.id) from auth.sessions t where user_id in (select user_id from public.piloto_usuarios(n21)))
  )) into v_depois;
  r := r || ' dados_operacionais_iguais=' || (v_antes = v_depois);

  -- segurança
  perform set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true);
  begin perform public.admin_listar_pilotos(); r := r || ' g_listar=ABERTO'; exception when others then r := r || ' g_listar=' || sqlerrm; end;
  begin perform public.admin_piloto_detalhe(v_p); r := r || ' g_detalhe=ABERTO'; exception when others then r := r || ' g_detalhe=' || sqlerrm; end;
  begin perform public.admin_capturar_piloto(v_p); r := r || ' g_capturar=ABERTO'; exception when others then r := r || ' g_capturar=' || sqlerrm; end;
  begin perform public.admin_encerrar_piloto(v_p, 'xxx'); r := r || ' g_encerrar=ABERTO'; exception when others then r := r || ' g_encerrar=' || sqlerrm; end;
  begin perform public.admin_criar_piloto(beta, 'x x x', public.piloto_hoje()); r := r || ' g_criar=ABERTO'; exception when others then r := r || ' g_criar=' || sqlerrm; end;
  execute 'set local role authenticated';
  begin perform count(*) from public.piloto; r := r || ' auth_tabela=ABERTO'; exception when others then r := r || ' auth_tabela=negado'; end;
  begin perform count(*) from public.piloto_snapshot; r := r || ' auth_snapshot=ABERTO'; exception when others then r := r || ' auth_snapshot=negado'; end;
  begin perform public.piloto_metricas(n21, current_date); r := r || ' auth_metricas=ABERTO'; exception when others then r := r || ' auth_metricas=negado'; end;
  begin perform public.piloto_coletar(); r := r || ' auth_coletar=ABERTO'; exception when others then r := r || ' auth_coletar=negado'; end;
  execute 'reset role';
  execute 'set local role anon';
  begin perform count(*) from public.piloto_atividade; r := r || ' anon_tabela=ABERTO'; exception when others then r := r || ' anon_tabela=negado'; end;
  begin perform public.admin_listar_pilotos(); r := r || ' anon_listar=ABERTO'; exception when others then r := r || ' anon_listar=negado'; end;
  execute 'reset role';

  raise exception 'RESULTADO %', r;
end $$;
