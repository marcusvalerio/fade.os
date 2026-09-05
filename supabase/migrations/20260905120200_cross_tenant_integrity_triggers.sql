-- FADE OS — auditoria de RLS (seção 21): fecha uma lacuna de integridade
-- entre tenants que as policies sozinhas não cobrem.
--
-- appointment_service_insert/update e attendance_item_insert/update só
-- confirmam que a linha PAI (appointment / attendance) pertence à empresa
-- do usuário. Nada impedia que o service_id/professional_id referenciado
-- DENTRO da linha apontasse para um profissional ou serviço de OUTRA
-- empresa (a FK só exige que a linha exista em algum tenant, não que seja
-- do mesmo tenant do appointment/attendance). Não é um vazamento de leitura
-- — RLS de leitura continua correta — mas é uma violação de integridade de
-- tenancy: um agendamento da empresa A passaria a referenciar um
-- profissional da empresa B.
--
-- Mesma lógica já usada em check_professional_service_same_company().

create or replace function public.check_appointment_service_same_company()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_appointment_company uuid;
  v_service_company uuid;
  v_professional_company uuid;
begin
  select company_id into v_appointment_company from public.appointment where id = new.appointment_id;
  select company_id into v_service_company from public.service where id = new.service_id;
  select company_id into v_professional_company from public.professional where id = new.professional_id;

  if v_appointment_company is null
     or v_service_company is null
     or v_professional_company is null
     or v_appointment_company <> v_service_company
     or v_appointment_company <> v_professional_company then
    raise exception 'Serviço e profissional precisam pertencer à mesma empresa do agendamento.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_appointment_service_same_company on public.appointment_service;
create trigger trg_appointment_service_same_company
  before insert or update on public.appointment_service
  for each row execute function public.check_appointment_service_same_company();

create or replace function public.check_attendance_item_same_company()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attendance_company uuid;
  v_service_company uuid;
  v_professional_company uuid;
begin
  select company_id into v_attendance_company from public.attendance where id = new.attendance_id;
  select company_id into v_service_company from public.service where id = new.service_id;
  select company_id into v_professional_company from public.professional where id = new.professional_id;

  if v_attendance_company is null
     or v_service_company is null
     or v_professional_company is null
     or v_attendance_company <> v_service_company
     or v_attendance_company <> v_professional_company then
    raise exception 'Serviço e profissional precisam pertencer à mesma empresa do atendimento.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_attendance_item_same_company on public.attendance_item;
create trigger trg_attendance_item_same_company
  before insert or update on public.attendance_item
  for each row execute function public.check_attendance_item_same_company();
