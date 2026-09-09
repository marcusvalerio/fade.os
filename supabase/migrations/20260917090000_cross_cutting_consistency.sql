-- FADE OS — Rodada de correção 04: consistência transversal.
--
-- Quatro problemas que sobreviveram às rodadas anteriores e que têm em comum
-- o mesmo formato: uma regra já resolvida em um lugar que não foi aplicada
-- em outro.

-- ---------------------------------------------------------------------------
-- 1. Os períodos analíticos são dias da barbearia
-- ---------------------------------------------------------------------------
-- A rodada 01 corrigiu a Agenda, mas as funções de métrica continuaram
-- recortando o período com `created_at::date between p_start and p_end`. Esse
-- cast resolve no timezone da SESSÃO — UTC no Postgres do Supabase — então
-- uma venda às 23:30 BRT (02:30Z do dia seguinte) caía no dia errado, e as
-- três primeiras horas de cada madrugada eram contadas na véspera.
--
-- Em vez de reescrever três funções grandes e arriscar transcrever errado o
-- que já está validado, fixa-se o timezone na própria função: todo `::date`
-- lá dentro passa a resolver no relógio da barbearia, incluindo os que eu
-- poderia não ter notado. `at time zone` explícito não é afetado, então nada
-- que já estava ancorado muda de comportamento.
--
-- Nenhuma definição de métrica muda. Só a fronteira do dia.
alter function public.get_dashboard_metrics(uuid, uuid, date, date)
  set timezone = 'America/Sao_Paulo';
alter function public.get_dashboard_series(uuid, uuid, date, date)
  set timezone = 'America/Sao_Paulo';
alter function public.get_dashboard_breakdown(uuid, uuid, date, date)
  set timezone = 'America/Sao_Paulo';

-- ---------------------------------------------------------------------------
-- 2. Onboarding não cria uma segunda empresa
-- ---------------------------------------------------------------------------
-- `/onboarding` abria para qualquer um, e `findIncompleteCompany()` filtra por
-- `onboarding_completed_at is null` — então para quem já concluiu ele devolvia
-- nada e o wizard seguia para `create_company_with_owner`, criando outra
-- empresa. Esconder a rota não basta: a proteção precisa estar onde a
-- mutação acontece.
--
-- A regra é do onboarding, não do produto: uma conta que já configurou uma
-- barbearia não abre outra POR ESTE CAMINHO. Se um dia existir gestão de
-- múltiplas empresas, ela entra por uma função própria, com sua própria
-- autorização — e não reaproveitando o fluxo de primeira configuração.
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

  if exists (
    select 1
    from public.user_company_role ucr
    join public.company c on c.id = ucr.company_id
    where ucr.user_id = v_user_id
      and c.onboarding_completed_at is not null
  ) then
    raise exception 'EMPRESA_JA_CONFIGURADA' using errcode = '22023';
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

revoke all on function public.create_company_with_owner(text, text, text, text, text, text) from public, anon;
grant execute on function public.create_company_with_owner(text, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. O endereço antigo continua levando à barbearia
-- ---------------------------------------------------------------------------
-- Trocar o slug matava o endereço anterior na hora, com HTTP 200 e
-- "Barbearia não encontrada" — indistinguível de um endereço que nunca
-- existiu. Cartão impresso, bio de rede social e link no WhatsApp morriam em
-- silêncio.
--
-- A escolha é histórico com redirecionamento, e não bloqueio da troca: o dono
-- precisa poder corrigir um slug errado, e um alias temporário só adia o
-- problema. O endereço antigo passa a ser um ponteiro permanente para o
-- atual.
--
-- Regra contra takeover: um slug que já pertenceu a alguém não fica livre
-- para outra empresa. Só a empresa que o teve pode retomá-lo — o que também
-- faz "voltar atrás" funcionar.
create table if not exists public.company_slug_history (
  slug text primary key,
  company_id uuid not null references public.company(id) on delete cascade,
  released_at timestamptz not null default now()
);

comment on table public.company_slug_history is
  'Endereços públicos que uma barbearia já teve. Servem para redirecionar links antigos e para impedir que outra empresa assuma um endereço com histórico.';

create index if not exists company_slug_history_company_idx
  on public.company_slug_history (company_id);

alter table public.company_slug_history enable row level security;

-- A resolução é pública (é o que faz o link antigo funcionar para um
-- visitante anônimo), mas só através da função abaixo.
revoke all on public.company_slug_history from authenticated, anon;

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
      -- Novo: o histórico também ocupa. Um endereço que já foi de outra
      -- barbearia não é oferecido nem tomado.
      and not exists (
        select 1 from public.company_slug_history h
        where h.slug = v_candidate
          and (p_exclude_company_id is null or h.company_id <> p_exclude_company_id)
      )
    );

    v_suffix := v_suffix + 1;
    v_candidate := v_base || '-' || v_suffix;
  end loop;

  return v_candidate;
end;
$$;

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
  v_base text;
  v_candidate text;
  v_company public.company;
  v_anterior text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not public.has_company_management_access(p_company_id) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select * into v_company from public.company where id = p_company_id;
  if not found then raise exception 'COMPANY_NOT_FOUND' using errcode='P0002'; end if;

  v_anterior := v_company.slug;
  v_base := coalesce(p_desired_slug, v_company.name);
  v_candidate := public.generate_available_company_slug(v_base, p_company_id);
  if not p_auto_suffix and v_candidate <> coalesce(public.slugify(v_base), 'barbearia') then
    raise exception 'SLUG_INDISPONIVEL' using errcode='23505';
  end if;

  if v_candidate is distinct from v_anterior then
    -- O endereço que sai passa a apontar para a barbearia; o que entra deixa
    -- de ser histórico (é o caso de voltar atrás).
    if v_anterior is not null then
      insert into public.company_slug_history (slug, company_id)
      values (v_anterior, p_company_id)
      on conflict (slug) do update set company_id = excluded.company_id, released_at = now();
    end if;
    delete from public.company_slug_history where slug = v_candidate;
  end if;

  perform set_config('fade.slug_change', p_company_id::text, true);
  update public.company set slug = v_candidate, updated_at = now()
    where id = p_company_id returning * into v_company;
  perform set_config('fade.slug_change', '', true);

  return v_company;
end;
$$;

revoke all on function public.set_company_slug(uuid, text, boolean) from public, anon;
grant execute on function public.set_company_slug(uuid, text, boolean) to authenticated;

-- Devolve o endereço ATUAL de uma barbearia a partir de qualquer endereço que
-- ela já teve. Null quando o endereço nunca existiu — o que continua sendo
-- "Barbearia não encontrada".
create or replace function public.resolve_company_slug(p_slug text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select c.slug from public.company c where c.slug = public.slugify(p_slug)),
    (select c.slug
       from public.company_slug_history h
       join public.company c on c.id = h.company_id
      where h.slug = public.slugify(p_slug))
  );
$$;

revoke all on function public.resolve_company_slug(text) from public;
grant execute on function public.resolve_company_slug(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. O cliente consegue saber quando a barbearia abre
-- ---------------------------------------------------------------------------
-- `unit_business_hours` já é a fonte de verdade da unidade, usada pelo motor
-- de disponibilidade. A vitrine simplesmente não lia. Esta função não
-- recalcula nada: devolve as mesmas linhas, para o dia fechado aparecer como
-- fechado em vez de sumir.
create or replace function public.get_public_business_hours(p_slug text)
returns table (
  weekday int,
  start_time time,
  end_time time,
  active boolean,
  note text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with unidade as (
    select u.id, u.business_hours_note
    from public.unit u
    join public.company c on c.id = u.company_id
    where c.slug = public.slugify(p_slug) and u.status = 'active'
    order by u.created_at
    limit 1
  ),
  dias as (select generate_series(0, 6) as weekday)
  select
    d.weekday,
    h.start_time,
    h.end_time,
    coalesce(h.active, false),
    un.business_hours_note
  from dias d
  cross join unidade un
  left join public.unit_business_hours h
    on h.unit_id = un.id and h.weekday = d.weekday and h.active
  order by d.weekday;
$$;

revoke all on function public.get_public_business_hours(text) from public;
grant execute on function public.get_public_business_hours(text) to anon, authenticated;
