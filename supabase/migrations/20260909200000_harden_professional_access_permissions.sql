-- BLOCO B: endurece permissões do acesso individual.
-- Profissional pode consultar apenas o próprio acesso; somente owner/admin
-- pode ativar, desativar ou resetar acesso de terceiros.

create or replace function public.has_company_management_access(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_company_role ucr
    join public.role r on r.id = ucr.role_id
    where ucr.user_id = auth.uid()
      and ucr.company_id = p_company_id
      and r.key in ('owner', 'admin')
  );
$$;

revoke all on function public.has_company_management_access(uuid) from public;
grant execute on function public.has_company_management_access(uuid) to authenticated;

-- RPCs existentes passam a exigir perfil administrativo.
-- As funções são recriadas apenas para trocar a autorização; a geração de
-- credenciais e demais regras permanecem iguais às da migration anterior.
create or replace function public.enable_professional_access(p_professional_id uuid, p_company_id uuid)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user_id uuid := auth.uid();
  v_identifier text; v_temp_password text; v_password_hash text;
  v_access public.professional_access;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if not public.has_company_management_access(p_company_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.professional where id = p_professional_id and company_id = p_company_id) then raise exception 'PROFESSIONAL_NOT_FOUND' using errcode = 'P0002'; end if;
  v_identifier := public.generate_unique_access_identifier();
  v_temp_password := chr(65 + (random() * 25)::int) || chr(97 + (random() * 25)::int) || (random() * 9)::int || chr(33 + (random() * 14)::int) || substring('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', floor(random() * 62)::int + 1, 8);
  v_password_hash := public.hash_password(v_temp_password);
  delete from public.professional_access where professional_id = p_professional_id;
  insert into public.professional_access (professional_id, company_id, access_identifier, temporary_password_hash, password_set_at, is_access_enabled)
  values (p_professional_id, p_company_id, v_identifier, v_password_hash, null, true)
  returning * into v_access;
  return json_build_object('access_identifier', v_identifier, 'temporary_password', v_temp_password, 'message', 'Compartilhe esses dados com o profissional. A senha deve ser alterada no primeiro acesso.');
end;
$$;

create or replace function public.disable_professional_access(p_professional_id uuid, p_company_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if not public.has_company_management_access(p_company_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.professional where id = p_professional_id and company_id = p_company_id) then raise exception 'PROFESSIONAL_NOT_FOUND' using errcode = 'P0002'; end if;
  update public.professional_access set is_access_enabled = false where professional_id = p_professional_id and company_id = p_company_id;
end;
$$;

create or replace function public.reset_professional_access(p_professional_id uuid, p_company_id uuid)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user_id uuid := auth.uid(); v_identifier text; v_temp_password text; v_password_hash text;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if not public.has_company_management_access(p_company_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.professional where id = p_professional_id and company_id = p_company_id) then raise exception 'PROFESSIONAL_NOT_FOUND' using errcode = 'P0002'; end if;
  v_identifier := public.generate_unique_access_identifier();
  v_temp_password := chr(65 + (random() * 25)::int) || chr(97 + (random() * 25)::int) || (random() * 9)::int || chr(33 + (random() * 14)::int) || substring('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', floor(random() * 62)::int + 1, 8);
  v_password_hash := public.hash_password(v_temp_password);
  update public.professional_access set access_identifier = v_identifier, temporary_password_hash = v_password_hash, password_set_at = null, is_access_enabled = true where professional_id = p_professional_id and company_id = p_company_id;
  return json_build_object('access_identifier', v_identifier, 'temporary_password', v_temp_password, 'message', 'Novo acesso gerado. Compartilhe com o profissional.');
end;
$$;

revoke all on function public.enable_professional_access(uuid, uuid) from public;
revoke all on function public.disable_professional_access(uuid, uuid) from public;
revoke all on function public.reset_professional_access(uuid, uuid) from public;
grant execute on function public.enable_professional_access(uuid, uuid) to authenticated;
grant execute on function public.disable_professional_access(uuid, uuid) to authenticated;
grant execute on function public.reset_professional_access(uuid, uuid) to authenticated;

-- Leitura: gestor/admin vê a empresa; profissional vê somente o próprio registro.
drop policy if exists professional_access_select on public.professional_access;
create policy professional_access_select on public.professional_access
  for select to authenticated
  using (
    public.has_company_management_access(company_id)
    or exists (select 1 from public.professional p where p.id = professional_id and p.user_id = auth.uid())
  );

drop policy if exists professional_access_update on public.professional_access;
create policy professional_access_update on public.professional_access
  for update to authenticated
  using (public.has_company_management_access(company_id))
  with check (public.has_company_management_access(company_id));
