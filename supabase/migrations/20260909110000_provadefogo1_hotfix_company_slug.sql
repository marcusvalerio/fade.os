-- FADE OS — PF1.1 Hotfix: create_company_with_owner() nunca definia slug
--
-- CAUSA RAIZ (confirmada ao vivo no Supabase real, duas vezes):
-- company.slug é NOT NULL e SEM DEFAULT desde a Fase 3. create_company_with_
-- owner() insere a empresa sem slug, então o próprio INSERT falha com
-- violação de NOT NULL — antes mesmo de qualquer código depois dele rodar.
-- Não existe como "consertar depois" com um UPDATE (como uma primeira
-- tentativa desta correção assumiu): o slug precisa existir NO INSERT.
--
-- CORREÇÃO
-- Extrai a lógica de geração de slug único (normalizar -> checar contra
-- reserved_slug e contra outras empresas -> auto-sufixo) de dentro de
-- set_company_slug() para uma função privada reaproveitável,
-- generate_available_company_slug(). set_company_slug() passa a usar essa
-- função (comportamento idêntico, nenhuma mudança de assinatura ou regra —
-- só remove duplicação). create_company_with_owner() usa a mesma função
-- para calcular o slug ANTES do INSERT e já cria a empresa com um slug
-- válido/único desde a primeira linha, na mesma transação do bootstrap.
--
-- Nenhuma mudança de RLS, tenancy, ou lógica de "primeira empresa
-- encontrada" — só a geração do slug em si.

create or replace function public.generate_available_company_slug(
  p_base_text text,
  p_exclude_company_id uuid default null
)
returns text
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_base text;
  v_candidate text;
  v_suffix int := 1;
begin
  v_base := coalesce(public.slugify(p_base_text), 'barbearia');
  v_candidate := v_base;

  loop
    exit when (
      not exists (select 1 from public.reserved_slug r where r.slug = v_candidate)
      and not exists (
        select 1 from public.company c
        where c.slug = v_candidate
          and (p_exclude_company_id is null or c.id <> p_exclude_company_id)
      )
    );

    v_suffix := v_suffix + 1;
    v_candidate := v_base || '-' || v_suffix;
  end loop;

  return v_candidate;
end;
$$;

revoke all on function public.generate_available_company_slug(text, uuid) from public;

-- set_company_slug(): mesmo comportamento de antes, agora delegando a busca
-- de candidato para a função compartilhada acima (só remove duplicação;
-- p_auto_suffix=false continua tratando colisão como erro amigável, igual
-- antes).
create or replace function public.set_company_slug(
  p_company_id uuid,
  p_desired_slug text default null,
  p_auto_suffix boolean default true
)
returns public.company
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_base text;
  v_candidate text;
  v_company public.company;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.user_company_role ucr
    where ucr.user_id = v_user_id and ucr.company_id = p_company_id
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_company from public.company where id = p_company_id;
  if not found then
    raise exception 'COMPANY_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_base := coalesce(p_desired_slug, v_company.name);
  v_candidate := public.generate_available_company_slug(v_base, p_company_id);

  if not p_auto_suffix and v_candidate <> coalesce(public.slugify(v_base), 'barbearia') then
    raise exception 'SLUG_INDISPONIVEL' using errcode = '23505';
  end if;

  update public.company set slug = v_candidate, updated_at = now()
  where id = p_company_id
  returning * into v_company;

  return v_company;
end;
$$;

revoke all on function public.set_company_slug(uuid, text, boolean) from public;
grant execute on function public.set_company_slug(uuid, text, boolean) to authenticated;

-- create_company_with_owner(): calcula o slug ANTES do insert, usando a
-- mesma função compartilhada — a empresa nunca existe sem slug, nem por um
-- instante.
create or replace function public.create_company_with_owner(
  p_name text,
  p_trade_name text default null,
  p_document text default null,
  p_phone text default null,
  p_email text default null,
  p_address text default null
)
returns public.company
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_role_id uuid;
  v_slug text;
  v_company public.company;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if coalesce(btrim(p_name), '') = '' then
    raise exception 'COMPANY_NAME_REQUIRED' using errcode = '22023';
  end if;

  select id into v_owner_role_id from public.role where key = 'owner';
  if v_owner_role_id is null then
    raise exception 'OWNER_ROLE_MISSING';
  end if;

  v_slug := public.generate_available_company_slug(p_name);

  insert into public.company (name, trade_name, document, phone, email, address, created_by, slug)
  values (p_name, p_trade_name, p_document, p_phone, p_email, p_address, v_user_id, v_slug)
  returning * into v_company;

  insert into public.user_company_role (user_id, company_id, role_id)
  values (v_user_id, v_company.id, v_owner_role_id);

  return v_company;
end;
$$;

revoke all on function public.create_company_with_owner(text, text, text, text, text, text) from public;
grant execute on function public.create_company_with_owner(text, text, text, text, text, text) to authenticated;
