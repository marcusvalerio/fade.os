-- P1.9: avaliação do cliente, de 0 a 5 em incrementos de 0,5, vinculada ao
-- atendimento concluído (nunca inventada — só existe depois que
-- close_attendance() e a sincronização de appointment.status='completed'
-- de P0.7 já rodaram).
create table public.attendance_rating (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id),
  attendance_id uuid not null unique references public.attendance(id),
  stars numeric(2,1) not null check (stars >= 0 and stars <= 5 and (stars * 2) = round(stars * 2)),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.attendance_rating enable row level security;

revoke all on public.attendance_rating from anon, authenticated;
grant select on public.attendance_rating to authenticated;

create policy attendance_rating_select on public.attendance_rating
  for select
  using (company_id in (select my_company_ids()));

-- Cliente avalia pelo link público do agendamento (client_access_token),
-- sem sessão. Só permite quando o agendamento já está 'completed' — a
-- mesma fonte de verdade que P0.7 corrigiu para a Agenda.
create or replace function public.submit_public_rating(p_token uuid, p_stars numeric, p_comment text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_appointment_id uuid;
  v_appointment_status text;
  v_company_id uuid;
  v_attendance_id uuid;
  v_rating_id uuid;
begin
  if p_stars is null or p_stars < 0 or p_stars > 5 or (p_stars * 2) <> round(p_stars * 2) then
    raise exception 'NOTA_INVALIDA' using errcode = '22023';
  end if;

  select a.id, a.status, a.company_id
    into v_appointment_id, v_appointment_status, v_company_id
  from public.appointment a
  where a.client_access_token = p_token;

  if v_appointment_id is null then
    raise exception 'AGENDAMENTO_NAO_ENCONTRADO' using errcode = 'P0002';
  end if;

  if v_appointment_status <> 'completed' then
    raise exception 'ATENDIMENTO_NAO_CONCLUIDO' using errcode = '22023';
  end if;

  select id into v_attendance_id from public.attendance where origin_appointment_id = v_appointment_id;
  if v_attendance_id is null then
    raise exception 'ATENDIMENTO_NAO_ENCONTRADO' using errcode = 'P0002';
  end if;

  insert into public.attendance_rating (company_id, attendance_id, stars, comment)
  values (v_company_id, v_attendance_id, p_stars, nullif(btrim(p_comment), ''))
  on conflict (attendance_id) do update
    set stars = excluded.stars, comment = excluded.comment, updated_at = now()
  returning id into v_rating_id;

  return v_rating_id;
end;
$function$;

revoke all on function public.submit_public_rating(uuid, numeric, text) from public;
grant execute on function public.submit_public_rating(uuid, numeric, text) to anon, authenticated;

-- Consulta separada (não altera get_public_appointment, cuja assinatura de
-- retorno outros callers já dependem) para saber se já existe avaliação.
create or replace function public.get_public_rating(p_token uuid)
returns table(stars numeric, comment text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select r.stars, r.comment
  from public.appointment a
  join public.attendance att on att.origin_appointment_id = a.id
  join public.attendance_rating r on r.attendance_id = att.id
  where a.client_access_token = p_token
  limit 1;
$function$;

revoke all on function public.get_public_rating(uuid) from public;
grant execute on function public.get_public_rating(uuid) to anon, authenticated;
