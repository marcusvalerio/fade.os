-- CORTEX.OS trailer — demo data for a LOCAL Supabase only.
--
-- Everything goes through the product's own paths where one exists:
-- create_company_with_owner, open_cash_session, add_attendance_service_item and
-- close_attendance run as the owner (auth.uid()), so sales, payments, cash
-- movements and commissions are derived by the real database logic. Plain
-- catalogue rows (unit, team, services, clients, bookings) are inserted directly.
--
-- The names are fictitious, consistent with the demo data already used in
-- app/landing-panels.tsx. The business day is fixed to Friday 25 Sep 2026
-- (America/Sao_Paulo), matching FAKE_NOW in ../config.mjs.
--
--   psql "$DB_URL" -v owner=<auth user id> -f seed.sql

\set ON_ERROR_STOP 1
\set day '2026-09-25'

begin;

-- ---------------------------------------------------------------- company
select set_config('request.jwt.claims', json_build_object('sub', :'owner', 'role', 'authenticated')::text, true);
set local role authenticated;
select id as company_id from public.create_company_with_owner(
  'Norte 21 Barbearia', 'Norte 21', null, '(11) 98877-2100', 'contato@norte21.demo', 'Rua Augusta, 1450 · Consolação'
) \gset
reset role;

update public.company set whatsapp = '11988772100', city = 'São Paulo', state = 'SP',
  onboarding_completed_at = now() - interval '60 days'
where id = :'company_id';

insert into public.unit (company_id, name, address, phone)
values (:'company_id', 'Norte 21 · Augusta', 'Rua Augusta, 1450 · Consolação, São Paulo', '(11) 98877-2100')
returning id as unit_id \gset

insert into public.unit_business_hours (unit_id, weekday, start_time, end_time)
select :'unit_id', d, '09:00', '20:00' from generate_series(1, 6) d;

insert into public.payment_method (company_id, method)
values (:'company_id', 'cash'), (:'company_id', 'pix'), (:'company_id', 'debit'), (:'company_id', 'credit');

-- ------------------------------------------------------------------- team
create temp table pro (key text primary key, id uuid);
with ins as (
  insert into public.professional (company_id, unit_id, name, role_title, default_commission_percent, phone)
  values (:'company_id', :'unit_id', 'Marcus Vieira', 'Barbeiro sênior', 45, '(11) 97711-0001'),
         (:'company_id', :'unit_id', 'Diego Ramos', 'Barbeiro', 40, '(11) 97711-0002'),
         (:'company_id', :'unit_id', 'André Lopes', 'Barbeiro', 40, '(11) 97711-0003'),
         (:'company_id', :'unit_id', 'Thiago Moura', 'Barbeiro', 40, '(11) 97711-0004')
  returning id, name
)
insert into pro select split_part(name, ' ', 1), id from ins;

insert into public.professional_schedule (professional_id, weekday, start_time, end_time)
select p.id, d, '09:00', '19:00' from pro p, generate_series(1, 6) d;

-- --------------------------------------------------------------- services
create temp table svc (key text primary key, id uuid, price numeric, minutes int);
with ins as (
  insert into public.service (company_id, name, category, default_price, planned_duration_minutes, default_commission_percent, description)
  values (:'company_id', 'Corte Social', 'Cabelo', 45, 30, null, 'Corte clássico na tesoura e máquina.'),
         (:'company_id', 'Corte Degradê', 'Cabelo', 50, 40, null, 'Degradê navalhado com acabamento.'),
         (:'company_id', 'Corte + Barba', 'Combo', 75, 60, null, 'Corte completo com barba modelada.'),
         (:'company_id', 'Barba Completa', 'Barba', 55, 45, null, 'Toalha quente, navalha e hidratação.'),
         (:'company_id', 'Corte + Barba + Hidratação', 'Combo', 110, 90, null, 'O ritual completo.'),
         (:'company_id', 'Sobrancelha', 'Acabamento', 20, 15, null, 'Design na navalha.'),
         (:'company_id', 'Pigmentação', 'Barba', 60, 40, null, 'Pigmentação de barba.')
  returning id, name, default_price, planned_duration_minutes
)
insert into svc select name, id, default_price, planned_duration_minutes from ins;

insert into public.professional_service (professional_id, service_id) select p.id, s.id from pro p, svc s;

-- ---------------------------------------------------------------- clients
create temp table cli (n int primary key, name text, id uuid);
insert into cli (n, name)
select row_number() over (), x from unnest(array[
  'Felipe Santos','Lucas Oliveira','Henrique Rocha','Leandro Costa','Mateus Ribeiro','Caio Martins','Pedro Nogueira',
  'Vinícius Prado','Rodrigo Alves','João Pedro Teles','Daniel Couto','Gustavo Lima','Rafael Mendes','Bruno Alves',
  'Eduardo Farias','Otávio Reis','Samuel Braga','Igor Tavares','Renato Siqueira','Fábio Cunha','Marcelo Dias',
  'Tiago Barros','Alexandre Pinto','Ricardo Moreira','Leonardo Freitas','Paulo Henrique','Diego Carvalho',
  'Gabriel Antunes','Arthur Menezes','Enzo Batista','Murilo Castro','Nicolas Peixoto','Victor Hugo Sales',
  'César Andrade','Júlio Monteiro','Hugo Salgado','Davi Correia','Bernardo Lins','Miguel Rezende','Álvaro Queiroz'
]) x;
with ins as (
  insert into public.client (company_id, name, phone, created_at)
  select :'company_id', c.name, '(11) 9' || lpad((8100 + c.n)::text, 4, '0') || '-' || lpad((1000 + c.n * 37 % 9000)::text, 4, '0'),
         timestamptz '2026-06-01 12:00-03' + (c.n * interval '2 days')
  from cli c order by c.n
  returning id, name
)
update cli set id = ins.id from ins where ins.name = cli.name;

-- ------------------------------------------------- 4 weeks of real history
-- Runs as the owner: every sale/payment/commission comes out of close_attendance.
create temp table hist (attendance_id uuid, at timestamptz);
grant all on hist, pro, svc, cli to authenticated;

select set_config('request.jwt.claims', json_build_object('sub', :'owner', 'role', 'authenticated')::text, true);
set local role authenticated;

select public.open_cash_session(cr.id, 200) from public.cash_register cr where cr.unit_id = :'unit_id';

do $$
declare
  v_company uuid := (select company_id from public.unit limit 1);
  v_unit uuid := (select id from public.unit limit 1);
  d date; k int; n int; v_att uuid; v_total numeric; v_client uuid; v_svc uuid; v_pro uuid; v_at timestamptz;
  methods text[] := array['pix','pix','credit','debit','cash','pix','credit'];
begin
  perform setseed(0.2109);
  for d in select generate_series(date '2026-08-27', date '2026-09-24', interval '1 day')::date loop
    continue when extract(dow from d) = 0;
    -- busier towards the weekend, and a gentle upward trend over the month
    n := 4 + (extract(dow from d)::int >= 5)::int * 4 + ((d - date '2026-08-27') / 7) * 5 + floor(random() * 3)::int;
    for k in 1..n loop
      v_client := (select id from cli order by random() limit 1);
      -- the last week leans on combos: the ticket grows along with the volume
      v_svc := (select id from svc order by random()
        * (case when key in ('Corte + Barba','Corte Degradê','Corte Social') then 0.4 else 1 end)
        * (case when d > date '2026-09-18' and key in ('Corte + Barba + Hidratação','Corte + Barba','Barba Completa') then 0.35 else 1 end)
        limit 1);
      v_pro := (select id from pro order by random() limit 1);
      v_at := (d::timestamp + time '09:15' + (k * (600.0 / n)) * interval '1 minute') at time zone 'America/Sao_Paulo';
      insert into public.attendance (company_id, unit_id, client_id, origin, status)
      values (v_company, v_unit, v_client, 'walk_in', 'in_progress') returning id into v_att;
      perform public.add_attendance_service_item(v_att, v_svc, v_pro, 0, 'normal', null, null);
      select sum(final_price) into v_total from public.attendance_item where attendance_id = v_att;
      perform public.close_attendance(v_att, 0, 0,
        jsonb_build_array(jsonb_build_object('method', methods[1 + floor(random() * 7)::int], 'amount', v_total)), null);
      insert into hist values (v_att, v_at);
    end loop;
  end loop;
end $$;

-- ------------------------------------------------------ today's agenda
-- (time, client, service, professional, status)
create temp table today (t time, client text, service text, pro text, status text, appt uuid, att uuid);
insert into today (t, client, service, pro, status) values
  ('08:30', 'Gustavo Lima',     'Corte Degradê',              'Diego',  'completed'),
  ('09:00', 'Rafael Mendes',    'Corte Social',               'Marcus', 'completed'),
  ('09:15', 'Eduardo Farias',   'Sobrancelha',                'Thiago', 'completed'),
  ('09:30', 'Bruno Alves',      'Corte + Barba',              'André',  'completed'),
  ('10:00', 'Felipe Santos',    'Barba Completa',             'Marcus', 'in_progress'),
  ('10:15', 'Lucas Oliveira',   'Corte + Barba',              'Diego',  'in_progress'),
  ('10:30', 'Henrique Rocha',   'Corte Degradê',              'Thiago', 'arrived'),
  ('11:00', 'Leandro Costa',    'Corte + Barba + Hidratação', 'André',  'confirmed'),
  ('11:15', 'Mateus Ribeiro',   'Corte Social',               'Marcus', 'confirmed'),
  ('11:30', 'Caio Martins',     'Pigmentação',                'Thiago', 'scheduled'),
  ('12:00', 'Pedro Nogueira',   'Barba Completa',             'Diego',  'confirmed'),
  ('13:30', 'Vinícius Prado',   'Corte Degradê',              'Marcus', 'scheduled'),
  ('14:00', 'Rodrigo Alves',    'Corte + Barba',              'André',  'confirmed'),
  ('15:00', 'João Pedro Teles', 'Sobrancelha',                'Diego',  'confirmed'),
  ('16:00', 'Daniel Couto',     'Corte Social',               'Thiago', 'confirmed'),
  ('17:30', 'Otávio Reis',      'Corte + Barba',              'Marcus', 'confirmed');
grant all on today to authenticated;

do $$
declare
  r record; v_company uuid := (select company_id from public.unit limit 1); v_unit uuid := (select id from public.unit limit 1);
  v_appt uuid; v_att uuid; v_total numeric; v_start timestamptz;
begin
  for r in select * from today order by t loop
    v_start := (date '2026-09-25' + r.t) at time zone 'America/Sao_Paulo';
    insert into public.appointment (company_id, unit_id, client_id, status, created_at)
    values (v_company, v_unit, (select id from cli where name = r.client), 'confirmed', v_start - interval '3 days')
    returning id into v_appt;
    insert into public.appointment_service (appointment_id, service_id, professional_id, starts_at, ends_at)
    select v_appt, s.id, p.id, v_start, v_start + s.minutes * interval '1 minute'
    from svc s, pro p where s.key = r.service and p.key = r.pro;

    if r.status in ('completed', 'in_progress') then
      -- same path as startAttendanceFromAppointment()
      insert into public.attendance (company_id, unit_id, client_id, origin_appointment_id, origin, status)
      values (v_company, v_unit, (select id from cli where name = r.client), v_appt, 'from_appointment', 'in_progress')
      returning id into v_att;
      perform public.add_attendance_service_item(v_att, s.id, p.id, 0, 'normal', null, null)
      from svc s, pro p where s.key = r.service and p.key = r.pro;
      update public.appointment set status = 'in_progress' where id = v_appt;
      if r.status = 'completed' then
        select sum(final_price) into v_total from public.attendance_item where attendance_id = v_att;
        perform public.close_attendance(v_att, 0, 0, jsonb_build_array(jsonb_build_object('method', 'pix', 'amount', v_total)), null);
      end if;
      insert into hist values (v_att, v_start + interval '2 minutes');
    else
      update public.appointment set status = r.status where id = v_appt;
    end if;
    update today set appt = v_appt, att = v_att where t = r.t;
    v_att := null;
  end loop;
end $$;

reset role;

-- --------------------------------------------- move history into the past
-- The ledger tables are append-only by trigger; this one-off backdating runs
-- with triggers disabled (superuser, local demo database only).
set local session_replication_role = replica;
update public.attendance a set created_at = h.at from hist h where a.id = h.attendance_id;
update public.attendance_item ai set created_at = h.at, started_at = h.at,
  ended_at = case when a.status = 'completed' then h.at + coalesce(ai.planned_duration_minutes, 40) * interval '1 minute' end
  from hist h, public.attendance a where ai.attendance_id = h.attendance_id and a.id = h.attendance_id;
update public.sale s set created_at = h.at + interval '40 minutes', updated_at = h.at + interval '40 minutes'
  from hist h where s.attendance_id = h.attendance_id;
update public.payment p set created_at = s.created_at from public.sale s where p.sale_id = s.id;
update public.cash_movement m set created_at = p.created_at
  from public.payment p where m.reference_id in (p.id, p.sale_id);
do $$
begin
  -- commission hangs off sale_item
  update public.sale_item si set created_at = s.created_at from public.sale s where si.sale_id = s.id;
  update public.commission c set created_at = si.created_at, updated_at = si.created_at
    from public.sale_item si where c.sale_item_id = si.id;
exception when undefined_column or undefined_table then null;
end $$;
update public.cash_session set opened_at = timestamptz '2026-08-27 09:00-03';

commit;

select count(*) as attendances, (select count(*) from public.sale) as sales, (select round(sum(total)) from public.sale) as revenue
from public.attendance;
