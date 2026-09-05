-- Agenda como central operacional: entre "confirmado" e "em atendimento"
-- existe um estado real de piso — o cliente chegou e está aguardando ser
-- chamado. Sem esse estado a agenda não consegue responder "quem está
-- aguardando agora", que é a pergunta operacional mais frequente do balcão.
alter table public.appointment
  drop constraint if exists appointment_status_check;

alter table public.appointment
  add constraint appointment_status_check check (
    status in (
      'scheduled', 'confirmed', 'arrived', 'in_progress', 'completed',
      'cancelled_by_client', 'cancelled_by_company', 'no_show'
    )
  );
