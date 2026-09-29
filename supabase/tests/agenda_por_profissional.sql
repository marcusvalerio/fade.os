-- Testes da agenda por profissional (20260930170000_agenda_por_profissional.sql).
--
-- Rodar no SQL Editor (ou pelo MCP) como postgres. Tudo acontece dentro de
-- um bloco que termina com RAISE EXCEPTION — a transação é desfeita e nada
-- fica gravado. O resultado vem na mensagem de erro "RESULTADO ...".
--
-- Esperado:
--   b_de_outros=0 · b_filtro_colega=0 · b_por_id_colega=0 · b_join_colega=0 ·
--   b_update_colega=0 · b_update_linha_colega=0 · b_delete_colega=0 ·
--   b_reagendar_colega=AGENDAMENTO_NAO_ENCONTRADO · b_starts_colega=0 ·
--   b_proprias = linhas do barbeiro no banco · g_linhas = linhas da empresa ·
--   g_por_id_colega=1 · slots_iguais=true · anon=0 · dados_iguais=true
--
-- Ajuste os ids se o ambiente for outro (b = usuário de um barbeiro com
-- papel staff; g = dono/gerente da mesma empresa; colega = professional de
-- outro barbeiro com agendamentos).
do $$
declare
  emp uuid := 'fc0b2c5d-26bd-496d-bbf0-1a330ccc9a48';
  b uuid := '7410248c-7255-4910-ada3-e06c1025f338';
  g uuid := '99dd0037-b3d2-44dd-b0ad-eb0f8e0bf9bc';
  colega uuid := 'fba699a0-472e-4f31-b800-7b026e4dbb3e';
  r text := '';
  v_antes text; v_depois text; v_meu uuid; v_appt uuid; v_srv uuid; v_unit uuid;
  v_n int; v_slots_b int; v_slots_g int; v_err text;
begin
  select md5(concat_ws('|',
    (select string_agg(t::text, ',' order by t.id) from public.appointment t where company_id = emp),
    (select string_agg(t::text, ',' order by t.id) from public.appointment_service t join public.appointment a on a.id = t.appointment_id where a.company_id = emp)
  )) into v_antes;

  select id into v_meu from public.professional where company_id = emp and user_id = b;
  select s.appointment_id, s.service_id into v_appt, v_srv
    from public.appointment_service s where s.professional_id = colega order by s.starts_at desc limit 1;
  select id into v_unit from public.unit where company_id = emp order by created_at limit 1;

  -- barbeiro
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into v_n from public.appointment_service; r := r || ' b_linhas=' || v_n;
  select count(*) into v_n from public.appointment_service where professional_id is distinct from v_meu; r := r || ' b_de_outros=' || v_n;
  select count(*) into v_n from public.appointment_service where professional_id = colega; r := r || ' b_filtro_colega=' || v_n;
  select count(*) into v_n from public.appointment where id = v_appt; r := r || ' b_por_id_colega=' || v_n;
  select count(*) into v_n from public.appointment a join public.client c on c.id = a.client_id where a.id = v_appt; r := r || ' b_join_colega=' || v_n;
  update public.appointment set status = status where id = v_appt; get diagnostics v_n = row_count; r := r || ' b_update_colega=' || v_n;
  update public.appointment_service set starts_at = starts_at where appointment_id = v_appt; get diagnostics v_n = row_count; r := r || ' b_update_linha_colega=' || v_n;
  delete from public.appointment where id = v_appt; get diagnostics v_n = row_count; r := r || ' b_delete_colega=' || v_n;
  begin
    perform public.reschedule_appointment(v_appt, now() + interval '3 days', null);
    v_err := 'ok';
  exception when others then v_err := sqlerrm;
  end;
  r := r || ' b_reagendar_colega=' || v_err;
  select count(*) into v_n from public.get_reschedule_starts(v_appt, (current_date + 1)); r := r || ' b_starts_colega=' || v_n;
  select count(*) into v_slots_b from public.get_available_slots(emp, v_unit, v_srv, current_date + 1, colega, null);

  -- gestor
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from public.appointment_service; r := r || ' g_linhas=' || v_n;
  select count(*) into v_n from public.appointment where id = v_appt; r := r || ' g_por_id_colega=' || v_n;
  select count(*) into v_slots_g from public.get_available_slots(emp, v_unit, v_srv, current_date + 1, colega, null);
  r := r || ' slots_iguais=' || (v_slots_b = v_slots_g) || '(' || v_slots_b || ')';

  -- anônimo
  reset role;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  select count(*) into v_n from public.appointment_service; r := r || ' anon=' || v_n;
  reset role;

  select count(*) into v_n from public.appointment_service where professional_id = v_meu; r := r || ' b_proprias_no_banco=' || v_n;
  select count(*) into v_n from public.appointment_service s join public.appointment a on a.id = s.appointment_id where a.company_id = emp;
  r := r || ' linhas_da_empresa=' || v_n;

  select md5(concat_ws('|',
    (select string_agg(t::text, ',' order by t.id) from public.appointment t where company_id = emp),
    (select string_agg(t::text, ',' order by t.id) from public.appointment_service t join public.appointment a on a.id = t.appointment_id where a.company_id = emp)
  )) into v_depois;
  r := r || ' dados_iguais=' || (v_antes = v_depois);

  raise exception 'RESULTADO%', r;
end $$;
