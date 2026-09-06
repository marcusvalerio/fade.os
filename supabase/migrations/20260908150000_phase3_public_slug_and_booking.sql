-- FADE OS — Fase 3: "Identidade da Barbearia + Agendamento do Cliente"
--
-- Aditiva, sobre o schema real já existente (não recria nem remove nada das
-- fases 1/2). Duas partes:
--
--   1. Slug público em `company` (identidade pública da barbearia) —
--      normalizado, único, com lista de rotas reservadas e auto-sufixo em
--      conflito (`barbeariadojoao`, `barbeariadojoao-2`, ...).
--
--   2. Uma camada seletiva de acesso público (SECURITY DEFINER, cada função
--      faz exatamente uma coisa, search_path fixo, EXECUTE revogado de
--      PUBLIC/anon por padrão e concedido só ao necessário) que resolve
--      slug → empresa → unidade/serviços/profissionais/disponibilidade sem
--      nunca depender de auth.uid() (o visitante é anônimo) e sem abrir as
--      tabelas inteiras para `anon`. A disponibilidade em si continua sendo
--      100% calculada por public.get_available_slots() da Fase 2 — a função
--      pública só resolve o slug e delega, nunca reimplementa a lógica do
--      motor.
--
-- Descoberta ao inspecionar o schema real antes de alterar (seção 22 da
-- especificação): tanto public.get_available_slots() quanto
-- public.create_company_with_owner() têm GRANT EXECUTE para `anon`/PUBLIC
-- concedido por padrão do Postgres (nenhuma migration anterior revogou
-- explicitamente). Hoje isso não vaza nada — get_available_slots é SECURITY
-- INVOKER e toda policy das tabelas que ela lê é restrita a `authenticated`,
-- então um chamador anon simplesmente recebe zero linhas;
-- create_company_with_owner já rejeita auth.uid() nulo internamente — mas
-- ambos os GRANTs são desnecessários agora que existe uma camada pública
-- própria, então esta migration os revoga (seção 23: "revogar EXECUTE
-- PUBLIC quando apropriado"). Também foi encontrado GRANT direto de
-- INSERT/SELECT/UPDATE/DELETE para `anon`/PUBLIC em várias tabelas da
-- aplicação (provavelmente o default do projeto, anterior às migrations
-- deste repo) — como RLS está habilitado em todas e nenhuma policy é
-- concedida à role `anon`, isso não expõe nada hoje (RLS nega por padrão na
-- ausência de policy aplicável), mas é uma limpeza maior, fora do escopo
-- desta fase; documentado no supabase/README.md como pendência de
-- hardening, não revogado aqui para não expandir o raio desta migration.

-- =============================================================================
-- PARTE 1 — SLUG
-- =============================================================================

create extension if not exists unaccent with schema extensions;

create table if not exists public.reserved_slug (
  slug text primary key
);

insert into public.reserved_slug (slug) values
  ('login'), ('criar-conta'), ('onboarding'), ('admin'), ('agenda'),
  ('atendimento'), ('clientes'), ('configuracoes'), ('inteligencia'),
  ('materiais'), ('produtos'), ('profissionais'), ('servicos'),
  ('dashboard'), ('financeiro'), ('estoque'), ('caixa'), ('crm'),
  ('api'), ('auth'), ('public'), ('static'), ('assets'), ('favicon'),
  ('robots'), ('sitemap'), ('_next'), ('www'), ('app'), ('sobre'),
  ('ajuda'), ('termos'), ('privacidade'), ('agendar'), ('agendamentos')
on conflict (slug) do nothing;

-- Normalização única (usada no backfill abaixo, no gerador de slug e
-- disponível para o app chamar via RPC se precisar de uma prévia
-- server-side — o app também mantém a mesma lógica em lib/slug.ts para
-- prévia instantânea no cliente, documentado ali).
create or replace function public.slugify(p_input text)
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select nullif(
    trim(both '-' from
      regexp_replace(
        lower(extensions.unaccent(coalesce(p_input, ''))),
        '[^a-z0-9]+', '-', 'g'
      )
    ),
    ''
  );
$$;

alter table public.company add column if not exists slug text;

-- Backfill das empresas reais já existentes (poucas linhas — confirmado por
-- introspecção antes desta migration). Cada uma recebe um slug derivado do
-- próprio nome, com auto-sufixo em caso de colisão entre elas mesmas.
do $$
declare
  r record;
  v_base text;
  v_candidate text;
  v_suffix int;
begin
  for r in select id, name from public.company where slug is null order by created_at loop
    v_base := coalesce(public.slugify(r.name), 'barbearia');
    v_candidate := v_base;
    v_suffix := 1;

    while exists (select 1 from public.company c where c.slug = v_candidate and c.id <> r.id)
       or exists (select 1 from public.reserved_slug rs where rs.slug = v_candidate) loop
      v_suffix := v_suffix + 1;
      v_candidate := v_base || '-' || v_suffix;
    end loop;

    update public.company set slug = v_candidate where id = r.id;
  end loop;
end;
$$;

alter table public.company alter column slug set not null;

alter table public.company drop constraint if exists company_slug_format_check;
alter table public.company add constraint company_slug_format_check
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 1 and 63);

create unique index if not exists company_slug_key on public.company (slug);

create or replace function public.check_company_slug_not_reserved()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.reserved_slug r where r.slug = new.slug) then
    raise exception 'SLUG_RESERVED' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_company_slug_not_reserved on public.company;
create trigger trg_company_slug_not_reserved
  before insert or update of slug on public.company
  for each row execute function public.check_company_slug_not_reserved();

-- Geração/edição de slug para o dono autenticado. SECURITY DEFINER porque a
-- checagem de unicidade precisa enxergar o slug de QUALQUER empresa (o slug
-- é, por natureza, informação pública — não há vazamento em comparar contra
-- ele), mas a autorização de update é explícita (auth.uid() precisa ter
-- vínculo com p_company_id em user_company_role) e a escrita fica restrita
-- à própria empresa, nunca a outra. p_auto_suffix=false é usado quando o
-- dono escolhe um slug manualmente (edição em Configurações): nesse caso
-- colisão vira erro amigável, não um sufixo surpresa.
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
  v_suffix int := 1;
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

  v_base := coalesce(public.slugify(p_desired_slug), public.slugify(v_company.name), 'barbearia');
  v_candidate := v_base;

  loop
    exit when (
      not exists (select 1 from public.reserved_slug r where r.slug = v_candidate)
      and not exists (select 1 from public.company c where c.slug = v_candidate and c.id <> p_company_id)
    );

    if not p_auto_suffix then
      raise exception 'SLUG_INDISPONIVEL' using errcode = '23505';
    end if;

    v_suffix := v_suffix + 1;
    v_candidate := v_base || '-' || v_suffix;
  end loop;

  update public.company set slug = v_candidate, updated_at = now()
  where id = p_company_id
  returning * into v_company;

  return v_company;
end;
$$;

revoke all on function public.set_company_slug(uuid, text, boolean) from public;
grant execute on function public.set_company_slug(uuid, text, boolean) to authenticated;

-- =============================================================================
-- PARTE 2 — COLUNAS DE SUPORTE
-- =============================================================================

-- Visibilidade pública independente de status: permite ocultar um serviço
-- da página pública/agendamento sem desativá-lo internamente.
alter table public.service add column if not exists is_public boolean not null default true;

-- Token de acesso do cliente ao próprio agendamento — aleatório e
-- imprevisível (não é o id sequencial/exposto do agendamento), devolvido
-- uma única vez na confirmação. É a base segura exigida pela seção 18: dá
-- para ver/cancelar o próprio agendamento sem autenticação de cliente,
-- porque quem não tem o token não tem como adivinhar ou enumerar outro.
alter table public.appointment add column if not exists client_access_token uuid not null default gen_random_uuid();
create unique index if not exists appointment_client_access_token_key on public.appointment (client_access_token);

-- Índice funcional para localizar cliente por telefone normalizado (só
-- dígitos) dentro da empresa — usado pelo find-or-create do agendamento
-- público. client.phone nunca foi normalizado nas fases anteriores (texto
-- livre), então a comparação também normaliza o lado armazenado.
create index if not exists client_company_phone_digits_idx
  on public.client (company_id, regexp_replace(coalesce(phone, ''), '\D', '', 'g'));

-- =============================================================================
-- PARTE 3 — CAMADA PÚBLICA (SECURITY DEFINER)
-- =============================================================================

-- Empresa + unidade primária pelo slug. Nunca "primeira empresa
-- encontrada" — sempre slug → company, e a unidade é a mais antiga com
-- status ativo dessa empresa (o modelo de multiunidade já existe, mas a
-- experiência pública desta fase é single-unit por design — seção 32
-- exclui "multiunidade avançado" explicitamente).
create or replace function public.get_public_company(p_slug text)
returns table (
  company_id uuid,
  name text,
  trade_name text,
  logo_url text,
  phone text,
  whatsapp text,
  address text,
  city text,
  state text,
  unit_id uuid,
  unit_name text,
  unit_address text,
  unit_phone text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    c.id, c.name, c.trade_name, c.logo_url, c.phone, c.whatsapp,
    c.address, c.city, c.state,
    u.id, u.name, u.address, u.phone
  from public.company c
  left join lateral (
    select id, name, address, phone
    from public.unit
    where unit.company_id = c.id and unit.status = 'active'
    order by created_at
    limit 1
  ) u on true
  where c.slug = public.slugify(p_slug);
$$;

revoke all on function public.get_public_company(text) from public;
grant execute on function public.get_public_company(text) to anon, authenticated;

create or replace function public.get_public_services(p_slug text)
returns table (
  service_id uuid,
  name text,
  description text,
  category text,
  default_price numeric,
  planned_duration_minutes int
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id, s.name, s.description, s.category, s.default_price, s.planned_duration_minutes
  from public.service s
  join public.company c on c.id = s.company_id
  where c.slug = public.slugify(p_slug)
    and s.status = 'active'
    and s.is_public
  order by s.category nulls last, s.name;
$$;

revoke all on function public.get_public_services(text) from public;
grant execute on function public.get_public_services(text) to anon, authenticated;

-- Somente profissionais ativos e realmente habilitados (professional_service)
-- para o serviço informado — nunca todos os profissionais da empresa.
create or replace function public.get_public_professionals(p_slug text, p_service_id uuid)
returns table (
  professional_id uuid,
  name text,
  avatar_url text,
  role_title text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.name, p.avatar_url, p.role_title
  from public.professional p
  join public.professional_service ps on ps.professional_id = p.id
  join public.service s on s.id = ps.service_id
  join public.company c on c.id = s.company_id
  where c.slug = public.slugify(p_slug)
    and s.id = p_service_id
    and s.status = 'active'
    and s.is_public
    and p.active
  order by p.name;
$$;

revoke all on function public.get_public_professionals(text, uuid) from public;
grant execute on function public.get_public_professionals(text, uuid) to anon, authenticated;

-- Disponibilidade pública: resolve o slug e delega 100% para o motor da
-- Fase 2 (public.get_available_slots). Como esta função é SECURITY
-- DEFINER, a chamada interna herda seu privilégio (o "invoker" de
-- get_available_slots passa a ser o dono desta função), então o resultado
-- não depende de nenhuma policy de `anon` existir — e nenhuma precisa ser
-- criada. p_unit_id é opcional: quando omitido, usa a mesma unidade
-- primária de get_public_company.
create or replace function public.get_public_available_slots(
  p_slug text,
  p_service_id uuid,
  p_date date,
  p_professional_id uuid default null,
  p_unit_id uuid default null
)
returns table (
  professional_id uuid,
  professional_name text,
  slot_start timestamptz,
  slot_end timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_unit_id uuid;
begin
  select c.id into v_company_id from public.company c where c.slug = public.slugify(p_slug);
  if v_company_id is null then
    raise exception 'BARBEARIA_NAO_ENCONTRADA' using errcode = 'P0002';
  end if;

  if p_unit_id is not null then
    if not exists (select 1 from public.unit u where u.id = p_unit_id and u.company_id = v_company_id) then
      raise exception 'UNIDADE_INVALIDA' using errcode = '22023';
    end if;
    v_unit_id := p_unit_id;
  else
    select u.id into v_unit_id from public.unit u
    where u.company_id = v_company_id and u.status = 'active'
    order by u.created_at limit 1;
  end if;

  if v_unit_id is null then
    raise exception 'UNIDADE_NAO_CONFIGURADA' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.service s
    where s.id = p_service_id and s.company_id = v_company_id and s.status = 'active' and s.is_public
  ) then
    raise exception 'SERVICO_INVALIDO' using errcode = '22023';
  end if;

  return query
    select * from public.get_available_slots(v_company_id, v_unit_id, p_service_id, p_date, p_professional_id);
end;
$$;

revoke all on function public.get_public_available_slots(text, uuid, date, uuid, uuid) from public;
grant execute on function public.get_public_available_slots(text, uuid, date, uuid, uuid) to anon, authenticated;

-- Criação do agendamento público. Todo id recebido é revalidado contra o
-- slug (nunca confia no que o frontend mandou), o preço/duração vêm do
-- serviço no banco (nunca do cliente), o horário final é reconfirmado
-- contra o motor da Fase 2 antes do insert (mensagem amigável no caso
-- comum) e a proteção definitiva contra concorrência continua sendo a
-- exclusion constraint appointment_service_no_overlap — se dois pedidos
-- colidirem exatamente na corrida, um deles recebe 23P01 aqui, que vira
-- HORARIO_INDISPONIVEL em vez de estourar um erro técnico.
create or replace function public.create_public_appointment(
  p_slug text,
  p_service_id uuid,
  p_professional_id uuid,
  p_starts_at timestamptz,
  p_client_name text,
  p_client_phone text,
  p_client_email text default null,
  p_unit_id uuid default null
)
returns table (
  appointment_id uuid,
  appointment_service_id uuid,
  client_access_token uuid,
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_unit_id uuid;
  v_duration int;
  v_ends_at timestamptz;
  v_client_name text := btrim(coalesce(p_client_name, ''));
  v_client_phone_digits text := regexp_replace(coalesce(p_client_phone, ''), '\D', '', 'g');
  v_client_email text := nullif(btrim(coalesce(p_client_email, '')), '');
  v_client_id uuid;
  v_appointment_id uuid;
  v_appointment_service_id uuid;
  v_client_access_token uuid;
  v_slot_ok boolean;
begin
  if length(v_client_name) < 2 or length(v_client_name) > 120 then
    raise exception 'NOME_INVALIDO' using errcode = '22023';
  end if;

  if length(v_client_phone_digits) < 10 or length(v_client_phone_digits) > 13 then
    raise exception 'TELEFONE_INVALIDO' using errcode = '22023';
  end if;

  if v_client_email is not null and v_client_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'EMAIL_INVALIDO' using errcode = '22023';
  end if;

  if p_starts_at <= now() then
    raise exception 'HORARIO_NO_PASSADO' using errcode = '22023';
  end if;

  select c.id into v_company_id from public.company c where c.slug = public.slugify(p_slug);
  if v_company_id is null then
    raise exception 'BARBEARIA_NAO_ENCONTRADA' using errcode = 'P0002';
  end if;

  if p_unit_id is not null then
    if not exists (select 1 from public.unit u where u.id = p_unit_id and u.company_id = v_company_id) then
      raise exception 'UNIDADE_INVALIDA' using errcode = '22023';
    end if;
    v_unit_id := p_unit_id;
  else
    select u.id into v_unit_id from public.unit u
    where u.company_id = v_company_id and u.status = 'active'
    order by u.created_at limit 1;
  end if;

  if v_unit_id is null then
    raise exception 'UNIDADE_NAO_CONFIGURADA' using errcode = 'P0002';
  end if;

  select s.planned_duration_minutes into v_duration
  from public.service s
  where s.id = p_service_id and s.company_id = v_company_id and s.status = 'active' and s.is_public;

  if v_duration is null then
    raise exception 'SERVICO_INVALIDO' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.professional p
    where p.id = p_professional_id and p.company_id = v_company_id and p.active
  ) then
    raise exception 'PROFISSIONAL_INVALIDO' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.professional_service ps
    where ps.professional_id = p_professional_id and ps.service_id = p_service_id
  ) then
    raise exception 'PROFISSIONAL_NAO_HABILITADO' using errcode = '22023';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_duration);

  -- Reconfirma que o horário exato ainda está entre os calculados pelo
  -- motor da Fase 2 — cobre o caso comum (jornada mudou, bloqueio novo,
  -- etc.) com uma mensagem amigável. A corrida de verdade (dois clientes no
  -- mesmo instante) ainda é pega pela exclusion constraint abaixo, porque
  -- entre esta checagem e o insert não há lock nenhum.
  select exists (
    select 1
    from public.get_available_slots(v_company_id, v_unit_id, p_service_id, p_starts_at::date, p_professional_id) g
    where g.professional_id = p_professional_id and g.slot_start = p_starts_at
  ) into v_slot_ok;

  if not v_slot_ok then
    raise exception 'HORARIO_INDISPONIVEL' using errcode = '23P01';
  end if;

  select cl.id into v_client_id
  from public.client cl
  where cl.company_id = v_company_id
    and regexp_replace(coalesce(cl.phone, ''), '\D', '', 'g') = v_client_phone_digits
  order by cl.created_at
  limit 1;

  if v_client_id is null then
    insert into public.client (company_id, name, phone, email)
    values (v_company_id, v_client_name, p_client_phone, v_client_email)
    returning id into v_client_id;
  end if;

  -- "as a" + RETURNING a.client_access_token porque client_access_token
  -- também é o nome de uma coluna de saída em RETURNS TABLE desta função —
  -- sem o alias, o Postgres cria uma variável implícita com o mesmo nome e
  -- a referência fica ambígua (erro 42702) entre ela e a coluna da tabela.
  insert into public.appointment as a (company_id, unit_id, client_id, status)
  values (v_company_id, v_unit_id, v_client_id, 'scheduled')
  returning a.id, a.client_access_token into v_appointment_id, v_client_access_token;

  begin
    insert into public.appointment_service (appointment_id, service_id, professional_id, starts_at, ends_at)
    values (v_appointment_id, p_service_id, p_professional_id, p_starts_at, v_ends_at)
    returning id into v_appointment_service_id;
  exception
    when exclusion_violation or unique_violation then
      delete from public.appointment where id = v_appointment_id;
      raise exception 'HORARIO_INDISPONIVEL' using errcode = '23P01';
  end;

  return query select v_appointment_id, v_appointment_service_id, v_client_access_token, p_starts_at, v_ends_at;
end;
$$;

revoke all on function public.create_public_appointment(text, uuid, uuid, timestamptz, text, text, text, uuid) from public;
grant execute on function public.create_public_appointment(text, uuid, uuid, timestamptz, text, text, text, uuid) to anon, authenticated;

-- Consulta/cancelamento do próprio agendamento pelo token — nunca pelo id
-- sequencial. Quem não tem o token não encontra a linha (a busca é
-- inteiramente pelo token, sem nenhum outro filtro que alguém possa
-- adivinhar).
create or replace function public.get_public_appointment(p_token uuid)
returns table (
  appointment_id uuid,
  status text,
  company_name text,
  unit_name text,
  service_name text,
  professional_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  price numeric,
  client_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    a.id, a.status, c.name, u.name, s.name, p.name,
    aps.starts_at, aps.ends_at, s.default_price, cl.name
  from public.appointment a
  join public.company c on c.id = a.company_id
  join public.unit u on u.id = a.unit_id
  join public.client cl on cl.id = a.client_id
  join public.appointment_service aps on aps.appointment_id = a.id
  join public.service s on s.id = aps.service_id
  join public.professional p on p.id = aps.professional_id
  where a.client_access_token = p_token
  order by aps.starts_at
  limit 1;
$$;

revoke all on function public.get_public_appointment(uuid) from public;
grant execute on function public.get_public_appointment(uuid) to anon, authenticated;

create or replace function public.cancel_public_appointment(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated int;
begin
  update public.appointment
  set status = 'cancelled_by_client'
  where client_access_token = p_token
    and status not in ('completed', 'cancelled_by_client', 'cancelled_by_company', 'no_show');

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.cancel_public_appointment(uuid) from public;
grant execute on function public.cancel_public_appointment(uuid) to anon, authenticated;

-- =============================================================================
-- PARTE 4 — HARDENING PONTUAL (funções descobertas com GRANT PUBLIC/anon
-- desnecessário ao inspecionar o schema para esta fase — seção 23)
-- =============================================================================

revoke execute on function public.get_available_slots(uuid, uuid, uuid, date, uuid) from public;
revoke execute on function public.get_available_slots(uuid, uuid, uuid, date, uuid) from anon;

revoke execute on function public.create_company_with_owner(text, text, text, text, text, text) from anon;
