-- FADE OS — Teste operacional: P0 #1, P1 #4, P1 #6 e P1 #7.
--
-- O TESTE OPERACIONAL MEDIU, com o papel `staff` real e as policies reais:
--
--   UPDATE service.default_price ........... 2 linhas alteradas
--   UPDATE product.sale_price .............. 2 linhas alteradas
--   UPDATE company.name / company.slug ..... 1 linha alterada
--   UPDATE unit_business_hours ............. 4 linhas alteradas
--   UPDATE professional.active ............. 1 linha alterada
--   UPDATE payment_method .................. 2 linhas alteradas
--   INSERT product / service / professional  PERMITIDO
--
-- E, com isso, o bypass completo do código de autorização:
--
--   Preço de catálogo ANTES ......................... R$ 80,00
--   Preço de catálogo DEPOIS do PATCH do staff ...... R$  1,00
--   Item gravado, sem código de autorização ......... R$  1,00
--
-- O trigger enforce_attendance_item_integrity fazia exatamente o que devia:
-- derivava o preço do catálogo. O catálogo é que não estava protegido. A
-- manipulação apenas subiu um nível — do item para o cadastro.
--
-- CAUSA RAIZ: em todo o schema, uma única tabela (`professional_access`)
-- tinha policy com gate de papel. Todas as outras eram escopadas só por
-- `my_company_ids()`, isto é, "é da minha empresa" — o que faz de `staff`,
-- no nível dos dados, o mesmo que `owner`. As Server Actions já chamavam
-- `requireCompanyManager` corretamente; o buraco era só no PostgREST, que
-- fala com as tabelas sem passar por elas.
--
-- CORREÇÃO, em duas camadas:
--
--   1. RLS por papel: escrita administrativa exige has_company_management_access.
--   2. Trigger que levanta erro explícito em vez de deixar o RLS devolver
--      "0 linhas" — um bypass não pode ser indistinguível de um no-op.
--
-- O que continua sendo do `staff` (operação do dia a dia, intocado):
-- client, appointment, appointment_service, attendance, attendance_item,
-- sale, sale_item, payment, commission, cash_session, cash_movement,
-- financial_entry, stock_movement e o saldo de estoque via apply_stock_delta.
--
-- Não é destrutivo: nenhuma linha é alterada ou removida, só policies,
-- privilégios e triggers.

-- ---------------------------------------------------------------------------
-- 1. Erro explícito, não silêncio
-- ---------------------------------------------------------------------------
-- Com RLS sozinha, um PATCH indevido volta "0 linhas" — igualzinho a um PATCH
-- que não encontrou nada. Quem está sondando não distingue "bloqueado" de
-- "não existe", mas quem está auditando também não, e é aí que um bypass se
-- esconde. Este trigger transforma a tentativa em 42501.
--
-- SECURITY DEFINER para poder resolver a empresa por tabelas que o chamador
-- talvez não leia; a decisão em si continua vindo de auth.uid(), via
-- has_company_management_access.
create or replace function public.assert_admin_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  v_mode text := tg_argv[0];
  v_company uuid;
  v_changed text[];
begin
  -- Exceção única e deliberada: a baixa/estorno de saldo é operação de venda,
  -- não de cadastro. apply_stock_delta (SECURITY DEFINER) mexe só em
  -- current_stock, e quem vende é o barbeiro. Qualquer outra coluna que venha
  -- junto cai na checagem normal abaixo.
  if tg_op = 'UPDATE' and tg_table_name in ('product', 'consumable') then
    select coalesce(array_agg(e.key), '{}')
      into v_changed
      from jsonb_each(v_row) e
      where e.value is distinct from (to_jsonb(old) -> e.key);

    if v_changed <@ array['current_stock', 'updated_at'] then
      return new;
    end if;
  end if;

  -- Sem sessão de usuário não há papel a checar. São dois casos, e nenhum
  -- deles é protegido por este trigger:
  --
  --   - `anon`: não tem policy nenhuma nestas tabelas (e a seção 4 abaixo
  --     tira também os GRANTs), então o RLS já recusa antes de chegar aqui;
  --   - service role / conexão direta: ignora RLS por definição e pode
  --     remover o próprio trigger. Bloquear aqui não protegeria nada e
  --     quebraria seed, migration de dados e script de suporte.
  --
  -- O trigger existe para transformar "0 linhas" em erro explícito para quem
  -- chega pelo PostgREST com um JWT. É esse caso que ele cobre.
  if auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_company := case v_mode
    when 'self' then (v_row->>'id')::uuid
    when 'company' then (v_row->>'company_id')::uuid
    else null
  end;

  if v_mode = 'unit' then
    select u.company_id into v_company
      from public.unit u where u.id = (v_row->>'unit_id')::uuid;
  elsif v_mode = 'professional' then
    select p.company_id into v_company
      from public.professional p where p.id = (v_row->>'professional_id')::uuid;
  elsif v_mode = 'schedule' then
    select p.company_id into v_company
      from public.professional_schedule s
      join public.professional p on p.id = s.professional_id
      where s.id = (v_row->>'schedule_id')::uuid;
  end if;

  -- Empresa indeterminável é recusa, não passe livre.
  if v_company is null or not public.has_company_management_access(v_company) then
    raise exception 'ACESSO_ADMINISTRATIVO_NECESSARIO' using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Sem grants a revogar: uma função `returns trigger` chamada diretamente
-- falha com "can only be called as a trigger function", então não há
-- superfície a fechar aqui.

-- ---------------------------------------------------------------------------
-- 2. Policies por papel
-- ---------------------------------------------------------------------------
-- As policies são permissivas e se somam por OR, então cada uma é substituída,
-- nunca acrescentada — deixar a antiga de pé anularia a nova.
do $$
declare
  -- tabela, escopo da empresa, comandos a trancar
  v_specs jsonb := '[
    {"t": "company",                     "scope": "id",                              "cmds": ["update"]},
    {"t": "unit",                        "scope": "company_id",                      "cmds": ["insert", "update"]},
    {"t": "service",                     "scope": "company_id",                      "cmds": ["insert", "update"]},
    {"t": "product",                     "scope": "company_id",                      "cmds": ["insert", "update"]},
    {"t": "consumable",                  "scope": "company_id",                      "cmds": ["insert", "update"]},
    {"t": "professional",                "scope": "company_id",                      "cmds": ["insert", "update"]},
    {"t": "payment_method",              "scope": "company_id",                      "cmds": ["insert", "update"]},
    {"t": "campaign",                    "scope": "company_id",                      "cmds": ["insert", "update"]},
    {"t": "cash_register",               "scope": "company_id",                      "cmds": ["insert"]},
    {"t": "unit_business_hours",         "scope": "unit",                            "cmds": ["insert", "update"]},
    {"t": "professional_service",        "scope": "professional",                    "cmds": ["insert", "update", "delete"]},
    {"t": "professional_schedule",       "scope": "professional",                    "cmds": ["insert", "update", "delete"]},
    {"t": "professional_block",          "scope": "professional",                    "cmds": ["insert", "update"]},
    {"t": "professional_absence",        "scope": "professional",                    "cmds": ["insert", "delete"]},
    {"t": "professional_schedule_break", "scope": "schedule",                        "cmds": ["insert", "delete"]}
  ]'::jsonb;
  v_spec jsonb;
  v_cmds text[];
  v_cmd text;
  v_table text;
  v_scope text;
  v_tenant text;
  v_gate text;
  v_policy text;
begin
  for v_spec in select * from jsonb_array_elements(v_specs) loop
    v_table := v_spec->>'t';
    v_scope := v_spec->>'scope';

    -- Escopo de empresa: "esta linha é da minha barbearia". É o que vai no
    -- USING, para que a linha CHEGUE no trigger e o erro seja explícito. Se o
    -- gate de papel ficasse aqui, o RLS filtraria a linha antes do BEFORE
    -- UPDATE e o PostgREST devolveria 0 linhas — indistinguível de "não
    -- existe", que é exatamente onde um bypass se esconde.
    v_tenant := case v_scope
      when 'id' then 'id in (select public.my_company_ids())'
      when 'company_id' then 'company_id in (select public.my_company_ids())'
      when 'unit' then
        'exists (select 1 from public.unit u where u.id = ' || quote_ident(v_table) ||
        '.unit_id and u.company_id in (select public.my_company_ids()))'
      when 'professional' then
        'exists (select 1 from public.professional p where p.id = ' || quote_ident(v_table) ||
        '.professional_id and p.company_id in (select public.my_company_ids()))'
      when 'schedule' then
        'exists (select 1 from public.professional_schedule s join public.professional p on p.id = s.professional_id where s.id = ' ||
        quote_ident(v_table) || '.schedule_id and p.company_id in (select public.my_company_ids()))'
    end;

    -- Gate de papel: vai no WITH CHECK, como segunda camada atrás do trigger.
    v_gate := case v_scope
      when 'id' then 'public.has_company_management_access(id)'
      when 'company_id' then 'public.has_company_management_access(company_id)'
      when 'unit' then
        'exists (select 1 from public.unit u where u.id = ' || quote_ident(v_table) ||
        '.unit_id and public.has_company_management_access(u.company_id))'
      when 'professional' then
        'exists (select 1 from public.professional p where p.id = ' || quote_ident(v_table) ||
        '.professional_id and public.has_company_management_access(p.company_id))'
      when 'schedule' then
        'exists (select 1 from public.professional_schedule s join public.professional p on p.id = s.professional_id where s.id = ' ||
        quote_ident(v_table) || '.schedule_id and public.has_company_management_access(p.company_id))'
    end;

    select array(select jsonb_array_elements_text(v_spec->'cmds')) into v_cmds;

    foreach v_cmd in array v_cmds loop
      v_policy := v_table || '_' || v_cmd;
      execute format('drop policy if exists %I on public.%I', v_policy, v_table);

      if v_cmd = 'insert' then
        execute format(
          'create policy %I on public.%I for insert to authenticated with check (%s)',
          v_policy, v_table, v_gate);
      elsif v_cmd = 'update' then
        execute format(
          'create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
          v_policy, v_table, v_tenant, v_gate);
      else
        -- DELETE não tem WITH CHECK; quem recusa é o trigger.
        execute format(
          'create policy %I on public.%I for delete to authenticated using (%s)',
          v_policy, v_table, v_tenant);
      end if;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Triggers
-- ---------------------------------------------------------------------------
-- `company` fica de fora do INSERT de propósito: create_company_with_owner
-- cria a empresa e o vínculo de owner na mesma transação, e no momento do
-- insert ainda não existe papel nenhum para checar.
do $$
declare
  v_specs jsonb := '[
    {"t": "company",                     "mode": "self",         "ops": "update or delete"},
    {"t": "unit",                        "mode": "company",      "ops": "insert or update or delete"},
    {"t": "service",                     "mode": "company",      "ops": "insert or update or delete"},
    {"t": "product",                     "mode": "company",      "ops": "insert or update or delete"},
    {"t": "consumable",                  "mode": "company",      "ops": "insert or update or delete"},
    {"t": "professional",                "mode": "company",      "ops": "insert or update or delete"},
    {"t": "payment_method",              "mode": "company",      "ops": "insert or update or delete"},
    {"t": "campaign",                    "mode": "company",      "ops": "insert or update or delete"},
    {"t": "cash_register",               "mode": "company",      "ops": "insert or update or delete"},
    {"t": "unit_business_hours",         "mode": "unit",         "ops": "insert or update or delete"},
    {"t": "professional_service",        "mode": "professional", "ops": "insert or update or delete"},
    {"t": "professional_schedule",       "mode": "professional", "ops": "insert or update or delete"},
    {"t": "professional_block",          "mode": "professional", "ops": "insert or update or delete"},
    {"t": "professional_absence",        "mode": "professional", "ops": "insert or update or delete"},
    {"t": "professional_schedule_break", "mode": "schedule",     "ops": "insert or update or delete"}
  ]'::jsonb;
  v_spec jsonb;
begin
  for v_spec in select * from jsonb_array_elements(v_specs) loop
    execute format('drop trigger if exists trg_admin_write on public.%I', v_spec->>'t');
    execute format(
      'create trigger trg_admin_write before %s on public.%I for each row execute function public.assert_admin_write(%L)',
      v_spec->>'ops', v_spec->>'t', v_spec->>'mode');
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Tirar `anon` das tabelas administrativas
-- ---------------------------------------------------------------------------
-- Hoje `anon` já é recusado pelo RLS (nenhuma destas tabelas tem policy para
-- ele), mas o GRANT continuava lá por default privilege do Supabase. Privilégio
-- sem uso é só superfície: a página pública de agendamento fala com o banco
-- exclusivamente pelas funções get_public_* / create_public_appointment, que
-- são SECURITY DEFINER e não dependem destes GRANTs.
do $$
declare
  v_table text;
  v_tables text[] := array[
    'company', 'unit', 'unit_business_hours', 'service', 'product', 'consumable',
    'professional', 'professional_service', 'professional_schedule',
    'professional_schedule_break', 'professional_block', 'professional_absence',
    'payment_method', 'campaign', 'cash_register', 'professional_access'
  ];
begin
  foreach v_table in array v_tables loop
    execute format('revoke insert, update, delete on public.%I from anon', v_table);
  end loop;
end $$;
