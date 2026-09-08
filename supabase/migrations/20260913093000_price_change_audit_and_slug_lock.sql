-- FADE OS — Teste operacional: rastreabilidade de preço e trava do slug.
--
-- Duas lacunas que o P0 #1 deixou à mostra:
--
-- (a) `service` não tinha trigger nenhum e `product` só tinha o de coerência
--     de empresa. Uma mudança de preço não deixava rastro. Como o preço do
--     item de atendimento é derivado do catálogo, quem mexe no catálogo mexe
--     no valor de toda venda futura — é exatamente o tipo de operação que a
--     trilha de auditoria existe para registrar. Agora que a escrita é de
--     owner/admin, falta saber QUEM mudou, QUANDO e DE QUANTO PARA QUANTO.
--
-- (b) `company.slug` decide a URL pública de agendamento. A migration
--     anterior tira o staff do caminho, mas um owner/admin ainda podia
--     escrever a coluna direto no PostgREST, passando por fora de
--     set_company_slug — e é ela quem consulta reserved_slug e resolve
--     colisão. Slug agora só muda por lá.
--
-- Reaproveita a infraestrutura que já existe: write_audit_log, que na
-- migration 20260913090000 virou a única porta de escrita da trilha e deriva
-- ator e empresa da sessão. Nenhum segredo entra no log — só nome da coluna,
-- valor anterior e valor novo.
--
-- Não é destrutivo: nenhuma linha é alterada ou removida.

-- ---------------------------------------------------------------------------
-- 1. Auditoria de alteração de valores sensíveis do catálogo
-- ---------------------------------------------------------------------------
create or replace function public.audit_price_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cols text[] := tg_argv;
  v_col text;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
  v_company uuid;
begin
  foreach v_col in array v_cols loop
    if (v_old -> v_col) is distinct from (v_new -> v_col) then
      v_before := v_before || jsonb_build_object(v_col, v_old -> v_col);
      v_after := v_after || jsonb_build_object(v_col, v_new -> v_col);
    end if;
  end loop;

  if v_before = '{}'::jsonb then
    return new;
  end if;

  -- Sem sessão de usuário não há ator a registrar: é a chave de service role
  -- (migration, script de manutenção), que por definição já está fora do
  -- alcance da RLS. Falhar aqui só quebraria a manutenção sem proteger nada,
  -- então a alteração passa sem log em vez de ser bloqueada.
  if auth.uid() is null then
    return new;
  end if;

  -- professional_service não tem company_id próprio nem id: a empresa vem do
  -- profissional, e a entidade auditada é o próprio profissional.
  if tg_table_name = 'professional_service' then
    select p.company_id into v_company
      from public.professional p where p.id = new.professional_id;
    perform public.write_audit_log(
      v_company, 'update_commission', 'professional_service', new.professional_id,
      v_before, v_after, null);
  else
    v_company := (v_new->>'company_id')::uuid;
    perform public.write_audit_log(
      v_company, 'update_price', tg_table_name, (v_new->>'id')::uuid,
      v_before, v_after, null);
  end if;

  return new;
end;
$$;

do $$
declare
  v_specs jsonb := '[
    {"t": "service",              "cols": ["default_price", "default_commission_percent"]},
    {"t": "product",              "cols": ["sale_price", "cost_price"]},
    {"t": "consumable",           "cols": ["cost_price"]},
    {"t": "professional_service", "cols": ["commission_percent"]}
  ]'::jsonb;
  v_spec jsonb;
  v_args text;
begin
  for v_spec in select * from jsonb_array_elements(v_specs) loop
    select string_agg(quote_literal(c), ', ')
      into v_args
      from jsonb_array_elements_text(v_spec->'cols') as c;

    execute format('drop trigger if exists trg_audit_price on public.%I', v_spec->>'t');
    execute format(
      'create trigger trg_audit_price after update on public.%I for each row execute function public.audit_price_change(%s)',
      v_spec->>'t', v_args);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Slug só muda por set_company_slug
-- ---------------------------------------------------------------------------
-- Mesma marca transacional que o código de autorização usa: set_config com
-- `is_local => true`, que vale só até o fim da transação e não vaza para a
-- próxima requisição do pool.
--
-- A trava vale inclusive para a service role, de propósito: não existe motivo
-- legítimo para escrever a coluna direto. Manutenção que precise mexer no slug
-- fora da função usa a mesma marca na própria transação —
-- `select set_config('fade.slug_change', '<company_id>', true);` antes do
-- UPDATE — o que deixa a intenção explícita em vez de acidental.
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
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not public.has_company_management_access(p_company_id) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select * into v_company from public.company where id = p_company_id;
  if not found then raise exception 'COMPANY_NOT_FOUND' using errcode='P0002'; end if;

  v_base := coalesce(p_desired_slug, v_company.name);
  v_candidate := public.generate_available_company_slug(v_base, p_company_id);
  if not p_auto_suffix and v_candidate <> coalesce(public.slugify(v_base), 'barbearia') then
    raise exception 'SLUG_INDISPONIVEL' using errcode='23505';
  end if;

  perform set_config('fade.slug_change', p_company_id::text, true);
  update public.company set slug = v_candidate, updated_at = now()
    where id = p_company_id returning * into v_company;
  perform set_config('fade.slug_change', '', true);

  return v_company;
end;
$$;

create or replace function public.enforce_company_slug_source()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.slug is distinct from old.slug
     and coalesce(current_setting('fade.slug_change', true), '') <> new.id::text then
    raise exception 'SLUG_SOMENTE_VIA_FUNCAO' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_company_slug_source on public.company;
create trigger trg_company_slug_source
  before update on public.company
  for each row execute function public.enforce_company_slug_source();
