-- ============================================================================
-- Disponibilidade para reagendamento
-- ============================================================================
--
-- Para mover um horário (reschedule_appointment), a tela precisa perguntar ao
-- motor "o que está livre SE este agendamento não existisse?" — senão o
-- próprio horário e os vizinhos que se sobrepõem a ele aparecem ocupados, e
-- mover um corte 15 minutos para frente fica impossível pela tela, embora o
-- banco aceite.
--
-- get_available_slots_excluding é o MESMO motor (derivado da definição viva
-- de get_available_slots, com substituições guardadas), com um parâmetro a
-- mais: o agendamento que não conta como ocupação. Nenhuma regra nova,
-- nenhuma cópia manual que possa divergir do original.
-- ============================================================================

do $$
declare
  v_def text := pg_get_functiondef('public.get_available_slots(uuid,uuid,uuid,date,uuid,uuid[])'::regprocedure);
  v_header_old constant text := 'public.get_available_slots(';
  v_occupancy_old constant text := 'and aps.is_active';
begin
  if position(v_header_old in v_def) = 0 or position(v_occupancy_old in v_def) = 0 then
    raise exception 'Definição inesperada de get_available_slots';
  end if;
  v_def := replace(v_def, v_header_old, 'public.get_available_slots_excluding(p_exclude_appointment_id uuid, ');
  v_def := replace(v_def, v_occupancy_old,
    'and aps.is_active' || E'\n        and aps.appointment_id is distinct from p_exclude_appointment_id');
  execute v_def;
end $$;

revoke all on function public.get_available_slots_excluding(uuid, uuid, uuid, uuid, date, uuid, uuid[]) from public, anon;
grant execute on function public.get_available_slots_excluding(uuid, uuid, uuid, uuid, date, uuid, uuid[]) to authenticated;
