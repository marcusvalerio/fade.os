-- BETA HARDENING: attendance completion must originate from the trusted
-- server-side close_attendance flow, not a direct client/RLS write.
create or replace function public.enforce_attendance_completion_origin()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if tg_op = 'INSERT' then
    if new.status = 'completed' and current_user <> 'postgres' then
      raise exception 'ATENDIMENTO_CONCLUSAO_NAO_AUTORIZADA' using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.status = 'completed' and old.status <> 'completed' and current_user <> 'postgres' then
      raise exception 'ATENDIMENTO_CONCLUSAO_NAO_AUTORIZADA' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_attendance_completion_origin on public.attendance;
create trigger trg_attendance_completion_origin
before insert or update on public.attendance
for each row execute function public.enforce_attendance_completion_origin();
