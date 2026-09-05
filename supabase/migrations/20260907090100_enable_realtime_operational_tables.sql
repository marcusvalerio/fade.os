-- A operação (Agenda/Atendimento) precisa refletir mudanças de estado ao
-- vivo. Sem isto na publication, o client do Supabase Realtime nunca recebe
-- eventos postgres_changes para essas tabelas, mesmo com RLS liberando a
-- leitura normal via select.
--
-- `alter publication ... add table` não aceita "if not exists" e falha a
-- transação inteira se qualquer uma das tabelas já for membro — por isso
-- cada uma é adicionada individualmente, condicionada a ainda não constar
-- em pg_publication_tables, para que a migration seja segura de re-rodar
-- e não dependa de a publication estar vazia antes desta rodada.
do $$
declare
  t text;
begin
  foreach t in array array['appointment', 'appointment_service', 'attendance', 'attendance_item']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
