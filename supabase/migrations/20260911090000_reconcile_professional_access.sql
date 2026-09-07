-- FADE OS — FASE 1: reconciliação do acesso profissional com o banco real.
--
-- Contexto (docs/auditoria-pre-piloto.md, P0.1 a P0.4): as quatro migrations
-- do BLOCO B existem no repositório mas nunca chegaram a produção, e não é
-- possível aplicá-las na ordem em que estão:
--
--   1. 20260909190000 cria get_professional_login_email, cujo corpo `language
--      sql` referencia public.professional_access — tabela que só nasce em
--      20260910000000. Com check_function_bodies ligado, a migration falha.
--   2. 20260910000000 define hash_password() chamando crypt()/gen_salt() sem
--      qualificar schema, sob `set search_path = public, pg_temp`. pgcrypto
--      está instalado em `extensions`, então essas chamadas nunca resolvem.
--
-- Esta migration consolida o BLOCO B na ordem correta de dependência. É
-- idempotente (pode rodar sobre um banco que já tenha parte do BLOCO B) e
-- não-destrutiva: nenhum DROP de tabela ou coluna, nenhuma alteração de dado
-- operacional existente.
--
-- Mudança de conteúdo em relação às migrations originais: a senha temporária
-- deixa de ser guardada como bcrypt no banco. A credencial efetiva sempre
-- pertenceu ao Supabase Auth — o hash local nunca era lido por nada e é
-- material sensível a mais. A coluna temporary_password_hash é preservada
-- (compatibilidade) mas passa a ser sempre null, o que também elimina a
-- dependência de pgcrypto no search_path.

-- ---------------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------------
create table if not exists public.professional_access (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null unique references public.professional (id) on delete cascade,
  company_id uuid not null references public.company (id) on delete cascade,
  access_identifier text not null unique,
  temporary_password_hash text,
  password_set_at timestamptz,
  is_access_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_identifier_format check (access_identifier ~ '^[A-Z0-9]{6}$')
);

comment on column public.professional_access.temporary_password_hash is
  'Legado do fluxo inicial. Não é mais escrito: a credencial efetiva pertence ao Supabase Auth.';

create index if not exists professional_access_professional_id_idx
  on public.professional_access (professional_id);
create index if not exists professional_access_company_id_idx
  on public.professional_access (company_id);
create index if not exists professional_access_identifier_idx
  on public.professional_access (access_identifier);

-- ---------------------------------------------------------------------------
-- 2. Integridade: o acesso nunca pode apontar para outra empresa
-- ---------------------------------------------------------------------------
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
    raise exception 'ACESSO_EMPRESA_DIVERGENTE' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_professional_access_same_company on public.professional_access;
create trigger trg_professional_access_same_company
  before insert or update on public.professional_access
  for each row execute function public.check_professional_access_same_company();

create or replace function public.update_professional_access_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
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
-- 3. Geradores
-- ---------------------------------------------------------------------------

-- Identificador de 6 caracteres. O alfabeto exclui de propósito os pares que
-- se confundem quando alguém lê o código em voz alta ou copia de um papel
-- (O/0, I/1, S/5), porque na prática o admin dita esse código para o
-- profissional. O CHECK da tabela continua aceitando [A-Z0-9]{6} — isto aqui
-- restringe apenas o que geramos, não o que é válido.
create or replace function public.generate_unique_access_identifier()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_identifier text;
  v_chars text := 'ABCDEFGHJKLMNPQRTUVWXYZ23456789';
  v_len int := length(v_chars);
  v_attempts int := 0;
  v_bytes bytea;
begin
  loop
    v_attempts := v_attempts + 1;
    if v_attempts > 100 then
      raise exception 'IDENTIFICADOR_INDISPONIVEL' using errcode = '55000';
    end if;

    v_bytes := extensions.gen_random_bytes(6);
    v_identifier := '';
    for i in 0..5 loop
      v_identifier := v_identifier || substr(v_chars, (get_byte(v_bytes, i) % v_len) + 1, 1);
    end loop;

    exit when not exists (
      select 1 from public.professional_access where access_identifier = v_identifier
    );
  end loop;

  return v_identifier;
end;
$$;

revoke all on function public.generate_unique_access_identifier() from public;

-- Senha temporária de uso único. Usa gen_random_bytes (CSPRNG) em vez de
-- random(): a versão anterior sorteava uma fatia contígua de 8 caracteres de
-- uma string fixa, o que dava ~62 possibilidades para dois terços da senha.
create or replace function public.generate_temporary_password()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  v_len int := length(v_chars);
  v_bytes bytea := extensions.gen_random_bytes(10);
  v_password text := '';
  v_symbols text := '!@#$%&*?';
begin
  for i in 0..9 loop
    v_password := v_password || substr(v_chars, (get_byte(v_bytes, i) % v_len) + 1, 1);
  end loop;

  -- Garante as classes que a validação de senha da aplicação exige
  -- (maiúscula, minúscula, número, especial) sem depender da sorte do sorteio:
  -- com 10 caracteres sorteados havia ~0,3% de chance de não sair nenhuma
  -- minúscula, e a senha temporária não passa por validação em lugar nenhum.
  return 'Fa' || v_password || '7'
    || substr(v_symbols, (get_byte(extensions.gen_random_bytes(1), 0) % length(v_symbols)) + 1, 1);
end;
$$;

revoke all on function public.generate_temporary_password() from public;

-- ---------------------------------------------------------------------------
-- 4. Autorização
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 5. RPCs de gestão do acesso — sempre owner/admin
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
  v_identifier text;
  v_temp_password text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.has_company_management_access(p_company_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.professional
    where id = p_professional_id and company_id = p_company_id
  ) then
    raise exception 'PROFESSIONAL_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_identifier := public.generate_unique_access_identifier();
  v_temp_password := public.generate_temporary_password();

  -- upsert em vez de delete+insert: preserva created_at e o id do registro,
  -- e não deixa uma janela sem linha caso algo falhe no meio.
  insert into public.professional_access as pa (
    professional_id, company_id, access_identifier,
    temporary_password_hash, password_set_at, is_access_enabled
  )
  values (p_professional_id, p_company_id, v_identifier, null, null, true)
  on conflict (professional_id) do update
    set access_identifier = excluded.access_identifier,
        company_id = excluded.company_id,
        temporary_password_hash = null,
        password_set_at = null,
        is_access_enabled = true;

  return json_build_object(
    'access_identifier', v_identifier,
    'temporary_password', v_temp_password
  );
end;
$$;

create or replace function public.disable_professional_access(
  p_professional_id uuid,
  p_company_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.has_company_management_access(p_company_id) then
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
  where professional_id = p_professional_id and company_id = p_company_id;
end;
$$;

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
  v_identifier text;
  v_temp_password text;
  v_updated int;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.has_company_management_access(p_company_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.professional
    where id = p_professional_id and company_id = p_company_id
  ) then
    raise exception 'PROFESSIONAL_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_identifier := public.generate_unique_access_identifier();
  v_temp_password := public.generate_temporary_password();

  update public.professional_access
  set access_identifier = v_identifier,
      temporary_password_hash = null,
      password_set_at = null,
      is_access_enabled = true
  where professional_id = p_professional_id and company_id = p_company_id;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'ACESSO_NAO_ENCONTRADO' using errcode = 'P0002';
  end if;

  return json_build_object(
    'access_identifier', v_identifier,
    'temporary_password', v_temp_password
  );
end;
$$;

revoke all on function public.enable_professional_access(uuid, uuid) from public;
revoke all on function public.disable_professional_access(uuid, uuid) from public;
revoke all on function public.reset_professional_access(uuid, uuid) from public;
grant execute on function public.enable_professional_access(uuid, uuid) to authenticated;
grant execute on function public.disable_professional_access(uuid, uuid) to authenticated;
grant execute on function public.reset_professional_access(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Lookup de login (sem sessão, portanto fora do RLS)
-- ---------------------------------------------------------------------------
-- Só existe porque o login começa anônimo: não há auth.uid() para o RLS usar.
-- Devolve exclusivamente o e-mail sintético de um acesso ativo — nunca senha,
-- hash, empresa, nome ou qualquer outro dado do profissional. Um identificador
-- inexistente e um identificador desativado retornam a mesma coisa (null),
-- para não virar um oráculo de "esse código existe".
create or replace function public.get_professional_login_email(p_identifier text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select lower(pa.access_identifier) || '@login.fade.os'
  from public.professional_access pa
  where pa.access_identifier = upper(p_identifier)
    and pa.is_access_enabled
  limit 1;
$$;

revoke all on function public.get_professional_login_email(text) from public;
grant execute on function public.get_professional_login_email(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------------
alter table public.professional_access enable row level security;

-- Leitura: owner/admin enxerga a empresa inteira; o profissional enxerga
-- apenas o próprio registro.
drop policy if exists professional_access_select on public.professional_access;
create policy professional_access_select on public.professional_access
  for select to authenticated
  using (
    public.has_company_management_access(company_id)
    or exists (
      select 1 from public.professional p
      where p.id = professional_id and p.user_id = auth.uid()
    )
  );

-- Escrita direta só por owner/admin. Ativação, desativação e reset continuam
-- passando pelas RPCs acima; esta policy existe para que uma chamada REST
-- direta de um profissional não consiga reabilitar o próprio acesso.
drop policy if exists professional_access_update on public.professional_access;
create policy professional_access_update on public.professional_access
  for update to authenticated
  using (public.has_company_management_access(company_id))
  with check (public.has_company_management_access(company_id));

-- Sem policy de insert/delete de propósito: criar ou remover um acesso é
-- exclusividade das RPCs security definer.

grant select, update on public.professional_access to authenticated;
