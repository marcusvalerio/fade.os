-- FADE OS — segunda auditoria de integridade cross-tenant
--
-- A rodada anterior fechou professional_service, appointment_service e
-- attendance_item (o vínculo entre a linha e as entidades referenciadas
-- DENTRO dela). Esta migration fecha o mesmo tipo de lacuna um nível acima:
-- appointment e attendance podiam ser criados com company_id de um tenant,
-- mas apontando unit_id/client_id (e, no caso de attendance,
-- origin_appointment_id) de OUTRO tenant — a FK só exige que a linha
-- referenciada exista em algum lugar, não que pertença à mesma empresa.
--
-- Não altera nenhuma migration anterior. Nenhuma das duas tabelas
-- (appointment, attendance) precisa de dado retroativo corrigido: os
-- triggers abaixo só validam INSERT/UPDATE novos, então não há operação
-- destrutiva nem verificação contra linhas já existentes.

-- ---------------------------------------------------------------------------
-- appointment: unit e client precisam ser da mesma empresa do agendamento.
-- ---------------------------------------------------------------------------
create or replace function public.check_appointment_same_company()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unit_company uuid;
  v_client_company uuid;
begin
  select company_id into v_unit_company from public.unit where id = new.unit_id;
  select company_id into v_client_company from public.client where id = new.client_id;

  if v_unit_company is null
     or v_client_company is null
     or v_unit_company <> new.company_id
     or v_client_company <> new.company_id then
    raise exception 'Unidade e cliente precisam pertencer à mesma empresa do agendamento.';
  end if;

  return new;
end;
$$;

revoke all on function public.check_appointment_same_company() from public;

drop trigger if exists trg_appointment_same_company on public.appointment;
create trigger trg_appointment_same_company
  before insert or update on public.appointment
  for each row execute function public.check_appointment_same_company();

-- ---------------------------------------------------------------------------
-- attendance: unit, client e (quando presente) o appointment de origem
-- precisam ser da mesma empresa do atendimento.
-- ---------------------------------------------------------------------------
create or replace function public.check_attendance_same_company()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unit_company uuid;
  v_client_company uuid;
  v_appointment_company uuid;
begin
  select company_id into v_unit_company from public.unit where id = new.unit_id;
  select company_id into v_client_company from public.client where id = new.client_id;

  if v_unit_company is null
     or v_client_company is null
     or v_unit_company <> new.company_id
     or v_client_company <> new.company_id then
    raise exception 'Unidade e cliente precisam pertencer à mesma empresa do atendimento.';
  end if;

  if new.origin_appointment_id is not null then
    select company_id into v_appointment_company
    from public.appointment
    where id = new.origin_appointment_id;

    if v_appointment_company is null or v_appointment_company <> new.company_id then
      raise exception 'O agendamento de origem precisa pertencer à mesma empresa do atendimento.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.check_attendance_same_company() from public;

drop trigger if exists trg_attendance_same_company on public.attendance;
create trigger trg_attendance_same_company
  before insert or update on public.attendance
  for each row execute function public.check_attendance_same_company();

-- ---------------------------------------------------------------------------
-- professional.user_id — conclusão da auditoria (seção 1 do pedido)
--
-- A coluna existe no schema mas não é lida nem escrita por nenhuma action
-- ou tela hoje (não há fluxo de "profissional loga como usuário" ou
-- permissão derivada dela). Sem uma regra de negócio real para amarrar,
-- não foi adicionada nenhuma constraint especulativa. Quando esse fluxo
-- existir, o invariante natural a impor nessa migration futura é:
-- professional.user_id só pode apontar para um usuário que já tem
-- user_company_role para a mesma professional.company_id — registrado aqui
-- como documentação, não como código.
-- ---------------------------------------------------------------------------
comment on column public.professional.user_id is
  'Vínculo opcional com auth.users, não lido/escrito por nenhuma action atual. '
  'Sem constraint de tenancy própria porque nenhum fluxo de negócio hoje depende '
  'dela — ver migration 20260906090000 para a análise completa antes de usar esta coluna.';

-- ---------------------------------------------------------------------------
-- Higiene de EXECUTE (seção 10 do pedido): funções de trigger não precisam
-- de EXECUTE concedido a ninguém — o Postgres as chama automaticamente como
-- parte do INSERT/UPDATE/DELETE na tabela, independente de grant de EXECUTE
-- na função. O grant público default (toda função nova recebe EXECUTE para
-- PUBLIC, a menos que seja revogado) não habilita nada de fato — chamar
-- essas funções diretamente via SELECT falha de qualquer forma, pois elas
-- dependem do contexto de trigger (NEW/OLD/TG_OP). Revogar é higiene, não
-- correção de uma vulnerabilidade explorável, mas fecha a auditoria pedida.
-- ---------------------------------------------------------------------------
revoke all on function public.check_professional_service_same_company() from public;
revoke all on function public.check_appointment_service_same_company() from public;
revoke all on function public.check_attendance_item_same_company() from public;
revoke all on function public.prevent_attendance_item_edit_after_completion() from public;
