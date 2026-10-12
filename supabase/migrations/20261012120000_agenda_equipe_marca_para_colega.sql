-- Agenda: a equipe volta a marcar VÁRIOS serviços para um colega.
--
-- Defeito (P1, introduzido por 20260930170000_agenda_por_profissional):
-- create_internal_appointment roda como quem chama (SECURITY INVOKER), então
-- cada linha de appointment_service passa pela política
-- appointment_service_insert, cuja WITH CHECK faz uma subconsulta em
-- appointment — e essa subconsulta obedece à nova appointment_select.
-- Quando um staff marca para um colega, a 1ª linha entra (o agendamento ainda
-- não tem linhas, logo é visível para a empresa). A partir dela o agendamento
-- passa a ter só linha do colega e some para quem marcou; a 2ª linha é
-- recusada ("new row violates row-level security policy") e a transação
-- inteira volta. Um serviço só, ou marcar para si mesmo, funciona.
--
-- Correção: a mesma de reschedule_appointment na migration anterior —
-- create_internal_appointment passa a SECURITY DEFINER e confere a
-- autorização explicitamente, antes de qualquer leitura:
--   * quem chama está logado e é da empresa (my_company_ids) — exatamente a
--     regra das políticas de INSERT de appointment e appointment_service;
--   * unidade e cliente da empresa (inalterado);
--   * cada linha: serviço da empresa e assert_appointment_slot_valid
--     (profissional da empresa, ativo, da unidade, habilitado, jornada,
--     funcionamento, bloqueio, ausência, conflito) — inalterado;
--   * triggers trg_appointment_same_company e
--     trg_appointment_service_same_company continuam valendo.
--
-- O que NÃO muda:
--   * nenhuma política. INSERT/UPDATE direto pela API continuam presos à
--     visibilidade do agendamento — ninguém ganha o poder de pendurar uma
--     linha num agendamento de colega que não vê (o que tornaria esse
--     agendamento visível para si);
--   * quem vê o quê: o agendamento marcado para o colega continua invisível
--     para quem marcou (a função devolve só o id);
--   * a mensagem para quem não é da empresa continua 42501 (antes vinha da
--     RLS, agora vem daqui);
--   * corpo, assinatura, retorno e erros da função, fora a checagem nova.
--
-- Idempotente (create or replace + grants). Não depende de dados nem de ids.

create or replace function public.create_internal_appointment(p_company_id uuid, p_unit_id uuid, p_client_id uuid, p_lines jsonb)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare v_appointment_id uuid; v_line jsonb; v_line_count int;
begin
  -- Roda como dona (sem RLS): a regra das políticas de INSERT é conferida
  -- aqui, antes de qualquer leitura, para não responder nada sobre outra
  -- empresa (unidade, cliente, profissional, horário).
  if auth.uid() is null
     or p_company_id is null
     or not exists (select 1 from public.my_company_ids() m where m = p_company_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  v_line_count := jsonb_array_length(coalesce(p_lines,'[]'::jsonb));
  if v_line_count = 0 then raise exception 'AGENDAMENTO_SEM_SERVICOS' using errcode='22023'; end if;

  if not exists (select 1 from public.unit u where u.id=p_unit_id and u.company_id=p_company_id) then
    raise exception 'UNIDADE_INVALIDA' using errcode='22023'; end if;
  if not exists (select 1 from public.client c where c.id=p_client_id and c.company_id=p_company_id) then
    raise exception 'CLIENTE_INVALIDO' using errcode='22023'; end if;

  insert into public.appointment (company_id, unit_id, client_id, status)
  values (p_company_id, p_unit_id, p_client_id, 'scheduled')
  returning id into v_appointment_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    declare
      v_service_id uuid := (v_line->>'service_id')::uuid;
      v_professional_id uuid := (v_line->>'professional_id')::uuid;
      v_starts_at timestamptz := (v_line->>'starts_at')::timestamptz;
      v_duration int; v_ends_at timestamptz;
    begin
      if v_starts_at is null then raise exception 'HORARIO_INVALIDO' using errcode='22023'; end if;

      select s.planned_duration_minutes into v_duration from public.service s
        where s.id=v_service_id and s.company_id=p_company_id and s.status='active';
      if v_duration is null then raise exception 'SERVICO_INVALIDO' using errcode='22023'; end if;

      v_ends_at := v_starts_at + make_interval(mins => v_duration);

      perform public.assert_appointment_slot_valid(p_company_id, p_unit_id, v_service_id, v_professional_id, v_starts_at, v_ends_at);

      begin
        insert into public.appointment_service (appointment_id, service_id, professional_id, starts_at, ends_at)
        values (v_appointment_id, v_service_id, v_professional_id, v_starts_at, v_ends_at);
      exception when exclusion_violation or unique_violation then
        raise exception 'HORARIO_INDISPONIVEL' using errcode='23P01';
      end;
    end;
  end loop;

  return v_appointment_id;
end;
$function$;

-- Mesma ACL de antes (create or replace preserva; repetido para ficar explícito).
revoke all on function public.create_internal_appointment(uuid, uuid, uuid, jsonb) from public, anon;
grant execute on function public.create_internal_appointment(uuid, uuid, uuid, jsonb) to authenticated, service_role;
