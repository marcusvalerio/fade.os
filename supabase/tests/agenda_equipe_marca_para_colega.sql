-- Testes: criar agendamento pela equipe × RLS da agenda por profissional
-- (20260930170000_agenda_por_profissional + 20261012120000_agenda_equipe_marca_para_colega).
--
-- Rodar SOMENTE num banco local/descartável ou num branch do Supabase, como
-- superusuário/postgres — NUNCA em produção. Tudo acontece numa transação que
-- termina em ROLLBACK; as fixtures são criadas aqui (nenhum id real).
--
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/agenda_equipe_marca_para_colega.sql
--
-- Saída: uma tabela caso × esperado × obtido. Se qualquer caso divergir, o
-- último bloco levanta exceção (e o psql sai com erro).
--
-- Personagens: empresa E1 (dono O1; staff B com o profissional PB; staff C com
-- PC), empresa E2 (dono O2; staff X com PX) e um usuário logado sem vínculo (U).

begin;

-- ── fixtures ───────────────────────────────────────────────────────────────
create temp table fx (k text primary key, id uuid not null default gen_random_uuid());
insert into fx (k) values ('O1'),('B'),('C'),('O2'),('X'),('U'),('E1'),('E2'),('U1'),('U2'),('K1'),('K2'),
  ('PB'),('PC'),('PX'),('S1'),('S2'),('S3'),('r_owner'),('r_staff');
create temp table r (ordem serial, caso text, esperado text, obtido text);
grant select on fx to authenticated, anon;
grant insert, select on r to authenticated, anon;
grant usage on sequence r_ordem_seq to authenticated, anon;

create function pg_temp.id(p_k text) returns uuid language sql stable as $$ select id from fx where k = p_k $$;

insert into auth.users (id, email)
  select id, lower(k) || '@teste.local' from fx where k in ('O1','B','C','O2','X','U');

-- papéis: usa os que já existirem (branch do Supabase) ou cria (banco vazio)
insert into public.role (id, key, name) values (pg_temp.id('r_owner'), 'owner', 'Dono'), (pg_temp.id('r_staff'), 'staff', 'Equipe')
  on conflict (key) do nothing;
update fx set id = (select id from public.role where key = 'owner') where k = 'r_owner';
update fx set id = (select id from public.role where key = 'staff') where k = 'r_staff';

insert into public.company (id, name, slug) values
  (pg_temp.id('E1'), 'Teste E1', 'teste-e1-' || substr(md5(random()::text), 1, 8)),
  (pg_temp.id('E2'), 'Teste E2', 'teste-e2-' || substr(md5(random()::text), 1, 8));
insert into public.user_company_role (user_id, company_id, role_id) values
  (pg_temp.id('O1'), pg_temp.id('E1'), pg_temp.id('r_owner')),
  (pg_temp.id('B'),  pg_temp.id('E1'), pg_temp.id('r_staff')),
  (pg_temp.id('C'),  pg_temp.id('E1'), pg_temp.id('r_staff')),
  (pg_temp.id('O2'), pg_temp.id('E2'), pg_temp.id('r_owner')),
  (pg_temp.id('X'),  pg_temp.id('E2'), pg_temp.id('r_staff'));
insert into public.unit (id, company_id, name) values (pg_temp.id('U1'), pg_temp.id('E1'), 'Unidade E1'), (pg_temp.id('U2'), pg_temp.id('E2'), 'Unidade E2');
insert into public.client (id, company_id, name) values (pg_temp.id('K1'), pg_temp.id('E1'), 'Cliente E1'), (pg_temp.id('K2'), pg_temp.id('E2'), 'Cliente E2');
insert into public.professional (id, company_id, user_id, name) values
  (pg_temp.id('PB'), pg_temp.id('E1'), pg_temp.id('B'), 'Barbeiro B'),
  (pg_temp.id('PC'), pg_temp.id('E1'), pg_temp.id('C'), 'Barbeiro C'),
  (pg_temp.id('PX'), pg_temp.id('E2'), pg_temp.id('X'), 'Barbeiro X');
insert into public.service (id, company_id, name, default_price, planned_duration_minutes) values
  (pg_temp.id('S1'), pg_temp.id('E1'), 'Corte', 50, 30),
  (pg_temp.id('S2'), pg_temp.id('E1'), 'Barba', 40, 30),
  (pg_temp.id('S3'), pg_temp.id('E2'), 'Corte E2', 50, 30);
insert into public.professional_service (professional_id, service_id) values
  (pg_temp.id('PB'), pg_temp.id('S1')), (pg_temp.id('PB'), pg_temp.id('S2')),
  (pg_temp.id('PC'), pg_temp.id('S1')), (pg_temp.id('PC'), pg_temp.id('S2')),
  (pg_temp.id('PX'), pg_temp.id('S3'));
insert into public.unit_business_hours (unit_id, weekday, start_time, end_time)
  select u, d, '07:00', '22:00' from (values (pg_temp.id('U1')), (pg_temp.id('U2'))) v(u), generate_series(0, 6) d;
insert into public.professional_schedule (professional_id, weekday, start_time, end_time)
  select p, d, '07:00', '22:00' from (values (pg_temp.id('PB')), (pg_temp.id('PC')), (pg_temp.id('PX'))) v(p), generate_series(0, 6) d;

-- ── utilitários ────────────────────────────────────────────────────────────
-- Entra como alguém (null = anon). Igual ao PostgREST: claims + papel.
create function pg_temp.entrar(p_k text) returns void language plpgsql as $$
begin
  if p_k is null then
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    execute 'set local role anon';
  else
    perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p_k), 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
  end if;
end $$;
create function pg_temp.sair() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Horário de teste: daqui a 7 dias, no relógio da barbearia.
create function pg_temp.hora(p_hhmi text) returns timestamptz language sql stable as $$
  select ((current_date + 7) + p_hhmi::time) at time zone 'America/Sao_Paulo' $$;
create function pg_temp.linha(p_servico text, p_prof text, p_hhmi text) returns jsonb language sql stable as $$
  select jsonb_build_object('service_id', pg_temp.id(p_servico), 'professional_id', pg_temp.id(p_prof), 'starts_at', pg_temp.hora(p_hhmi)) $$;

-- Chama a RPC como o app chama; devolve 'ok' (e guarda o id) ou 'erro:<sqlstate>'.
create function pg_temp.criar(p_caso text, p_empresa text, p_unidade text, p_cliente text, p_linhas jsonb) returns text language plpgsql as $$
declare v uuid;
begin
  v := public.create_internal_appointment(pg_temp.id(p_empresa), pg_temp.id(p_unidade), pg_temp.id(p_cliente), p_linhas);
  insert into r (caso, esperado, obtido) values ('_id:' || p_caso, '', v::text);
  return 'ok';
exception when others then
  return 'erro:' || sqlstate;
end $$;
create function pg_temp.appt(p_caso text) returns uuid language sql stable as $$
  select nullif(obtido, '')::uuid from r where caso = '_id:' || p_caso $$;
create function pg_temp.confere(p_caso text, p_esperado text, p_obtido text) returns void language sql as $$
  insert into r (caso, esperado, obtido) values (p_caso, p_esperado, coalesce(p_obtido, '<null>')) $$;
-- Contagens vistas pela sessão atual (RLS aplicada).
create function pg_temp.ve_appt(p_caso text) returns text language sql stable as $$
  select count(*)::text from public.appointment where id = pg_temp.appt(p_caso) $$;
create function pg_temp.ve_linhas(p_caso text) returns text language sql stable as $$
  select count(*)::text from public.appointment_service where appointment_id = pg_temp.appt(p_caso) $$;
-- Contagem real (sem RLS), chamada só depois de sair().
create function pg_temp.linhas_reais(p_caso text) returns text language sql stable as $$
  select count(*)::text from public.appointment_service where appointment_id = pg_temp.appt(p_caso) $$;

-- ── 1. Criação legítima ────────────────────────────────────────────────────
do $$
begin
  -- gestor, vários serviços para um profissional da equipe
  perform pg_temp.entrar('O1');
  perform pg_temp.confere('A1 dono: 2 serviços p/ PC', 'ok',
    pg_temp.criar('A1', 'E1', 'U1', 'K1', jsonb_build_array(pg_temp.linha('S1', 'PC', '08:00'), pg_temp.linha('S2', 'PC', '08:30'))));
  perform pg_temp.confere('A1 dono vê as linhas', '2', pg_temp.ve_linhas('A1'));
  perform pg_temp.sair();

  -- staff para si
  perform pg_temp.entrar('B');
  perform pg_temp.confere('A2 staff: 2 serviços p/ si', 'ok',
    pg_temp.criar('A2', 'E1', 'U1', 'K1', jsonb_build_array(pg_temp.linha('S1', 'PB', '09:00'), pg_temp.linha('S2', 'PB', '09:30'))));
  perform pg_temp.confere('A2 staff vê as próprias linhas', '2', pg_temp.ve_linhas('A2'));

  -- staff para colega, 1 serviço
  perform pg_temp.confere('A3 staff: 1 serviço p/ colega', 'ok',
    pg_temp.criar('A3', 'E1', 'U1', 'K1', jsonb_build_array(pg_temp.linha('S1', 'PC', '10:00'))));
  perform pg_temp.confere('A3 staff NÃO vê o do colega', '0', pg_temp.ve_appt('A3'));

  -- staff para colega, 2 serviços (o defeito)
  perform pg_temp.confere('A4 staff: 2 serviços p/ colega', 'ok',
    pg_temp.criar('A4', 'E1', 'U1', 'K1', jsonb_build_array(pg_temp.linha('S1', 'PC', '11:00'), pg_temp.linha('S2', 'PC', '11:30'))));
  perform pg_temp.confere('A4 staff NÃO vê o do colega', '0', pg_temp.ve_appt('A4'));

  -- staff para colega, 3 serviços
  perform pg_temp.confere('A5 staff: 3 serviços p/ colega', 'ok',
    pg_temp.criar('A5', 'E1', 'U1', 'K1', jsonb_build_array(pg_temp.linha('S1', 'PC', '12:00'), pg_temp.linha('S2', 'PC', '12:30'), pg_temp.linha('S1', 'PC', '13:00'))));

  -- misto: colega primeiro, depois si
  perform pg_temp.confere('A6 staff: colega + si (nessa ordem)', 'ok',
    pg_temp.criar('A6', 'E1', 'U1', 'K1', jsonb_build_array(pg_temp.linha('S1', 'PC', '14:00'), pg_temp.linha('S2', 'PB', '14:30'))));
  perform pg_temp.confere('A6 staff vê o agendamento (tem linha dele)', '1', pg_temp.ve_appt('A6'));
  perform pg_temp.confere('A6 staff vê as 2 linhas da visita', '2', pg_temp.ve_linhas('A6'));

  -- conflito na 2ª linha: nada pode sobrar (atomicidade)
  perform pg_temp.confere('A7 staff: 2ª linha em conflito com A4', 'erro:23P01',
    pg_temp.criar('A7', 'E1', 'U1', 'K1', jsonb_build_array(pg_temp.linha('S1', 'PC', '15:00'), pg_temp.linha('S2', 'PC', '11:30'))));
  perform pg_temp.sair();

  perform pg_temp.confere('A4 gravou as 2 linhas', '2', pg_temp.linhas_reais('A4'));
  perform pg_temp.confere('A5 gravou as 3 linhas', '3', pg_temp.linhas_reais('A5'));
  perform pg_temp.confere('A7 não deixou agendamento órfão', '0',
    (select count(*)::text from public.appointment a where a.company_id = pg_temp.id('E1')
        and not exists (select 1 from public.appointment_service s where s.appointment_id = a.id)));

  perform pg_temp.entrar('C');
  perform pg_temp.confere('A4 colega C vê o agendamento', '1', pg_temp.ve_appt('A4'));
  perform pg_temp.confere('A4 colega C vê as 2 linhas', '2', pg_temp.ve_linhas('A4'));
  perform pg_temp.sair();
  perform pg_temp.entrar('O1');
  perform pg_temp.confere('A4 dono vê o agendamento', '1', pg_temp.ve_appt('A4'));
  perform pg_temp.sair();
end $$;

-- ── 2. Isolamento entre empresas ───────────────────────────────────────────
do $$
declare v_n int; v_estado text;
begin
  -- X (E2) tenta criar em E1 com dados válidos de E1
  perform pg_temp.entrar('X');
  perform pg_temp.confere('I1 outra empresa cria em E1', 'erro:42501',
    pg_temp.criar('I1', 'E1', 'U1', 'K1', jsonb_build_array(pg_temp.linha('S1', 'PC', '16:00'))));
  perform pg_temp.confere('I2 outra empresa vê agendamentos de E1', '0',
    (select count(*)::text from public.appointment where company_id = pg_temp.id('E1')));
  perform pg_temp.confere('I3 outra empresa vê linhas de E1', '0',
    (select count(*)::text from public.appointment_service where appointment_id = pg_temp.appt('A1')));
  update public.appointment set status = 'cancelled_by_company' where id = pg_temp.appt('A1');
  get diagnostics v_n = row_count;
  perform pg_temp.confere('I4 outra empresa altera agendamento de E1', '0', v_n::text);
  update public.appointment_service set is_active = false where appointment_id = pg_temp.appt('A1');
  get diagnostics v_n = row_count;
  perform pg_temp.confere('I5 outra empresa altera linhas de E1', '0', v_n::text);
  begin
    insert into public.appointment_service (appointment_id, service_id, professional_id, starts_at, ends_at)
    -- serviço e profissional de E1: passa pelo trigger de mesma empresa e cai na RLS
    values (pg_temp.appt('A1'), pg_temp.id('S1'), pg_temp.id('PC'), pg_temp.hora('17:00'), pg_temp.hora('17:30'));
    v_estado := 'ok';
  exception when others then v_estado := 'erro:' || sqlstate;
  end;
  perform pg_temp.confere('I6 outra empresa insere linha em E1', 'erro:42501', v_estado);
  begin
    perform public.reschedule_appointment(pg_temp.appt('A1'), pg_temp.hora('18:00'), null);
    v_estado := 'ok';
  exception when others then v_estado := 'erro:' || sqlstate;
  end;
  perform pg_temp.confere('I7 outra empresa reagenda em E1', 'erro:P0002', v_estado);
  perform pg_temp.sair();

  -- B (E1) tenta criar em E2, e misturar dados de E2 em E1
  perform pg_temp.entrar('B');
  perform pg_temp.confere('I8 staff cria em outra empresa', 'erro:42501',
    pg_temp.criar('I8', 'E2', 'U2', 'K2', jsonb_build_array(pg_temp.linha('S3', 'PX', '16:00'))));
  perform pg_temp.confere('I9 profissional de outra empresa', 'erro:22023',
    pg_temp.criar('I9', 'E1', 'U1', 'K1', jsonb_build_array(pg_temp.linha('S1', 'PX', '16:00'))));
  perform pg_temp.confere('I10 cliente de outra empresa', 'erro:22023',
    pg_temp.criar('I10', 'E1', 'U1', 'K2', jsonb_build_array(pg_temp.linha('S1', 'PB', '16:00'))));
  perform pg_temp.confere('I11 unidade de outra empresa', 'erro:22023',
    pg_temp.criar('I11', 'E1', 'U2', 'K1', jsonb_build_array(pg_temp.linha('S1', 'PB', '16:00'))));
  perform pg_temp.confere('I12 serviço de outra empresa', 'erro:22023',
    pg_temp.criar('I12', 'E1', 'U1', 'K1', jsonb_build_array(pg_temp.linha('S3', 'PB', '16:00'))));
  perform pg_temp.sair();

  -- logado sem vínculo e anônimo
  perform pg_temp.entrar('U');
  perform pg_temp.confere('I13 logado sem empresa cria em E1', 'erro:42501',
    pg_temp.criar('I13', 'E1', 'U1', 'K1', jsonb_build_array(pg_temp.linha('S1', 'PB', '16:00'))));
  perform pg_temp.sair();
  perform pg_temp.entrar(null);
  perform pg_temp.confere('I14 anônimo chama a RPC', 'erro:42501',
    pg_temp.criar('I14', 'E1', 'U1', 'K1', jsonb_build_array(pg_temp.linha('S1', 'PB', '16:00'))));
  perform pg_temp.confere('I15 anônimo vê agendamentos', '0', (select count(*)::text from public.appointment));
  perform pg_temp.sair();

  perform pg_temp.confere('I16 nenhuma tentativa negada gravou algo', '0',
    (select count(*)::text from r where caso in ('_id:I1','_id:I8','_id:I9','_id:I10','_id:I11','_id:I12','_id:I13','_id:I14')));
end $$;

-- ── 3. Linhas sem autorização (sem ampliar a RLS) ──────────────────────────
do $$
declare v_n int; v_estado text;
begin
  perform pg_temp.entrar('B');
  -- pendurar linha própria num agendamento só do colega (tornaria-o visível)
  begin
    insert into public.appointment_service (appointment_id, service_id, professional_id, starts_at, ends_at)
    values (pg_temp.appt('A4'), pg_temp.id('S1'), pg_temp.id('PB'), pg_temp.hora('19:00'), pg_temp.hora('19:30'));
    v_estado := 'ok';
  exception when others then v_estado := 'erro:' || sqlstate;
  end;
  perform pg_temp.confere('L1 staff insere linha direto em agendamento do colega', 'erro:42501', v_estado);
  update public.appointment_service set professional_id = pg_temp.id('PB') where appointment_id = pg_temp.appt('A4');
  get diagnostics v_n = row_count;
  perform pg_temp.confere('L2 staff altera linhas do colega', '0', v_n::text);
  update public.appointment set status = 'cancelled_by_company' where id = pg_temp.appt('A4');
  get diagnostics v_n = row_count;
  perform pg_temp.confere('L3 staff cancela agendamento do colega', '0', v_n::text);
  delete from public.appointment where id = pg_temp.appt('A4');
  get diagnostics v_n = row_count;
  perform pg_temp.confere('L4 staff apaga agendamento do colega', '0', v_n::text);
  begin
    perform public.reschedule_appointment(pg_temp.appt('A4'), pg_temp.hora('20:00'), null);
    v_estado := 'ok';
  exception when others then v_estado := 'erro:' || sqlstate;
  end;
  perform pg_temp.confere('L5 staff reagenda agendamento do colega', 'erro:P0002', v_estado);
  perform pg_temp.sair();

  -- controle: o próprio colega altera a própria linha
  perform pg_temp.entrar('C');
  update public.appointment_service set is_active = true where appointment_id = pg_temp.appt('A4') and professional_id = pg_temp.id('PC');
  get diagnostics v_n = row_count;
  perform pg_temp.confere('L6 colega altera as próprias linhas', '2', v_n::text);
  perform pg_temp.sair();

  perform pg_temp.confere('L7 A4 continua com 2 linhas, todas do colega', '2',
    (select count(*)::text from public.appointment_service where appointment_id = pg_temp.appt('A4') and professional_id = pg_temp.id('PC')));
end $$;

-- ── resultado ──────────────────────────────────────────────────────────────
select caso, esperado, obtido, case when esperado = obtido then 'ok' else 'FALHOU' end as status
  from r where caso not like '\_id:%' order by ordem;

do $$
declare v_falhas text;
begin
  select string_agg(caso || ' (esperado ' || esperado || ', obtido ' || obtido || ')', '; ' order by ordem)
    into v_falhas from r where caso not like '\_id:%' and esperado <> obtido;
  if v_falhas is not null then
    raise exception 'FALHAS: %', v_falhas;
  end if;
  raise notice 'todos os casos passaram (% verificações)', (select count(*) from r where caso not like '\_id:%');
end $$;

rollback;
