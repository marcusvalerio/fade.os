-- A operação (Agenda/Atendimento) precisa refletir mudanças de estado ao
-- vivo. Sem isto na publication, o client do Supabase Realtime nunca recebe
-- eventos postgres_changes para essas tabelas, mesmo com RLS liberando a
-- leitura normal via select.
alter publication supabase_realtime add table
  public.appointment,
  public.appointment_service,
  public.attendance,
  public.attendance_item;
