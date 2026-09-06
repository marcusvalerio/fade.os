-- FADE OS — BLOCO B: Professional Access
--
-- Novo fluxo de login individual para profissionais:
--
-- ADMIN → cria profissional (cadastro básico, sem acesso ao sistema)
--      → clica "Ativar Acesso" na tela do profissional
--      → sistema gera: identificador 6-char + senha temporária
--      → admin compartilha com o profissional
--      → profissional faz login com identificador + senha temporária
--      → sistema obriga mudança de senha no primeiro acesso
--      → profissional agora tem acesso pleno ao FADE.OS
--
-- ADMIN pode:
--      → desativar acesso (sem deletar histórico)
--      → resetar acesso (nova senha temporária)
--      → visualizar status de acesso

-- ---------------------------------------------------------------------------
-- professional_access: gerenciamento de acesso ao sistema
-- ---------------------------------------------------------------------------
create table if not exists public.professional_access (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null unique references public.professional (id) on delete cascade,
  company_id uuid not null references public.company (id) on delete cascade,
  access_identifier text not null unique, -- 6 caracteres alfanuméricos
  temporary_password_hash text,            -- hash bcrypt (nunca texto puro)
  password_set_at timestamptz,             -- null = obrigado trocar no login
  is_access_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_identifier_format check (
    access_identifier ~ '^[A-Z0-9]{6}$'
  )
);

create index if not exists professional_access_professional_id_idx on public.professional_access (professional_id);
create index if not exists professional_access_company_id_idx on public.professional_access (company_id);
create index if not exists professional_access_identifier_idx on public.professional_access (access_identifier);

-- Garantir que professional_access.company_id = professional.company_id
-- (evita professional de empresa A tendo acesso vinculado à empresa B)
create or replace function public.check_professional_access_same_company()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prof_company uuid;
begin
  select company_id into v_prof_company
  from public.professional
  where id = new.professional_id;

  if v_prof_company is null or v_prof_company <> new.company_id then
    raise exception 'Professional e access devem pertencer à mesma empresa.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_professional_access_same_company on public.professional_access;
create trigger trg_professional_access_same_company
  before insert or update on public.professional_access
  for each row execute function public.check_professional_access_same_company();

-- Atualizar updated_at automaticamente
create or replace function public.update_professional_access_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_professional_access_updated_at on public.professional_access;
create trigger trg_professional_access_updated_at
  before update on public.professional_access
  for each row execute function public.update_professional_access_updated_at();

-- ---------------------------------------------------------------------------
-- Função auxiliar: gerar identificador de 6 caracteres único
-- ---------------------------------------------------------------------------
create or replace function public.generate_unique_access_identifier()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_identifier text;
  v_chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  v_attempts int := 0;
begin
  loop
    v_attempts := v_attempts + 1;
    if v_attempts > 100 then
      raise exception 'Não foi possível gerar identificador único após 100 tentativas.';
    end if;

    v_identifier := '';
    for i in 1..6 loop
      v_identifier := v_identifier || substr(v_chars, floor(random() * 36)::int + 1, 1);
    end loop;

    exit when not exists (
      select 1 from public.professional_access
      where access_identifier = v_identifier
    );
  end loop;

  return v_identifier;
end;
$$;

revoke all on function public.generate_unique_access_identifier() from public;

-- ---------------------------------------------------------------------------
-- Função auxiliar: gerar hash de senha (usando crypt do PostgreSQL)
-- Retorna hash bcrypt em vez de texto puro
-- ---------------------------------------------------------------------------
create or replace function public.hash_password(p_password text)
returns text
language plpgsql
immutable
as $$
begin
  -- gen_salt('bf', 12) = bcrypt com salt rounds 12
  return crypt(p_password, gen_salt('bf', 12));
end;
$$;

revoke all on function public.hash_password(text) from public;

-- ---------------------------------------------------------------------------
-- RPC: enable_professional_access
-- Admin chama para ativar acesso de um profissional
-- Retorna: { access_identifier, temporary_password }
-- Senha é mostrada UMA VEZ — nunca mais recuperável (armazenamos só hash)
-- ---------------------------------------------------------------------------
create or replace function public.enable_professional_access(
  p_professional_id uuid,
  p_company_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_identifier text;
  v_temp_password text;
  v_password_hash text;
  v_access public.professional_access;
begin
  -- Validação: usuário autenticado
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  -- Validação: usuário tem acesso à empresa
  if not exists (
    select 1 from public.user_company_role
    where user_id = v_user_id and company_id = p_company_id
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- Validação: profissional existe e pertence à empresa
  if not exists (
    select 1 from public.professional
    where id = p_professional_id and company_id = p_company_id
  ) then
    raise exception 'PROFESSIONAL_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Gerar identificador único
  v_identifier := public.generate_unique_access_identifier();

  -- Gerar senha temporária: 12 caracteres com maiúscula, minúscula, número e especial
  -- Exemplo: Tr0p@c@l!9K2
  v_temp_password := (
    chr(65 + (random() * 25)::int) ||                           -- maiúscula aleatória
    chr(97 + (random() * 25)::int) ||                           -- minúscula aleatória
    (random() * 9)::int ||                                      -- número
    chr(33 + (random() * 14)::int) ||                           -- caractere especial
    substring(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      floor(random() * 62)::int + 1,
      8
    )
  );

  -- Hash da senha
  v_password_hash := public.hash_password(v_temp_password);

  -- Deletar acesso anterior se existir (substituir)
  delete from public.professional_access where professional_id = p_professional_id;

  -- Criar novo registro de acesso
  insert into public.professional_access (
    professional_id,
    company_id,
    access_identifier,
    temporary_password_hash,
    password_set_at,
    is_access_enabled
  )
  values (
    p_professional_id,
    p_company_id,
    v_identifier,
    v_password_hash,
    null, -- null = obrigado trocar no login
    true
  )
  returning * into v_access;

  -- Retornar APENAS UMA VEZ (sender deve mostrar ao admin e ele compartilha)
  return json_build_object(
    'access_identifier', v_identifier,
    'temporary_password', v_temp_password,
    'message', 'Compartilhe esses dados com o profissional. A senha deve ser alterada no primeiro acesso.'
  );
end;
$$;

revoke all on function public.enable_professional_access(uuid, uuid) from public;
grant execute on function public.enable_professional_access(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: disable_professional_access
-- Admin chama para desativar acesso (sem deletar histórico)
-- ---------------------------------------------------------------------------
create or replace function public.disable_professional_access(
  p_professional_id uuid,
  p_company_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.user_company_role
    where user_id = v_user_id and company_id = p_company_id
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.professional
    where id = p_professional_id and company_id = p_company_id
  ) then
    raise exception 'PROFESSIONAL_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.professional_access
  set is_access_enabled = false
  where professional_id = p_professional_id;
end;
$$;

revoke all on function public.disable_professional_access(uuid, uuid) from public;
grant execute on function public.disable_professional_access(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: reset_professional_access
-- Admin chama para resetar acesso (gera novo identifier + password)
-- Força profissional a trocar senha no próximo login
-- ---------------------------------------------------------------------------
create or replace function public.reset_professional_access(
  p_professional_id uuid,
  p_company_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_identifier text;
  v_temp_password text;
  v_password_hash text;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.user_company_role
    where user_id = v_user_id and company_id = p_company_id
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.professional
    where id = p_professional_id and company_id = p_company_id
  ) then
    raise exception 'PROFESSIONAL_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Gerar novo identificador
  v_identifier := public.generate_unique_access_identifier();

  -- Gerar nova senha temporária
  v_temp_password := (
    chr(65 + (random() * 25)::int) ||
    chr(97 + (random() * 25)::int) ||
    (random() * 9)::int ||
    chr(33 + (random() * 14)::int) ||
    substring(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      floor(random() * 62)::int + 1,
      8
    )
  );

  v_password_hash := public.hash_password(v_temp_password);

  update public.professional_access
  set
    access_identifier = v_identifier,
    temporary_password_hash = v_password_hash,
    password_set_at = null,
    is_access_enabled = true
  where professional_id = p_professional_id;

  return json_build_object(
    'access_identifier', v_identifier,
    'temporary_password', v_temp_password,
    'message', 'Novo acesso gerado. Compartilhe com o profissional.'
  );
end;
$$;

revoke all on function public.reset_professional_access(uuid, uuid) from public;
grant execute on function public.reset_professional_access(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLC (Row Level Security) em professional_access
-- ---------------------------------------------------------------------------
alter table public.professional_access enable row level security;

-- Admin/Gestor vê acesso de profissionais da sua empresa
drop policy if exists professional_access_select on public.professional_access;
create policy professional_access_select on public.professional_access
  for select to authenticated
  using (
    company_id in (select public.my_company_ids())
  );

-- Atualizar policy: só admin/gestor pode atualizar (desativar, resetar)
drop policy if exists professional_access_update on public.professional_access;
create policy professional_access_update on public.professional_access
  for update to authenticated
  using (
    company_id in (select public.my_company_ids())
  )
  with check (
    company_id in (select public.my_company_ids())
  );

-- Grants
grant select, update on public.professional_access to authenticated;
grant execute on function public.enable_professional_access(uuid, uuid) to authenticated;
grant execute on function public.disable_professional_access(uuid, uuid) to authenticated;
grant execute on function public.reset_professional_access(uuid, uuid) to authenticated;
