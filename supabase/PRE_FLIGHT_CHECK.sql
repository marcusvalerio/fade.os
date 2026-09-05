-- FADE OS — verificação pré-aplicação (rodar no SQL Editor do Supabase,
-- contra o banco de produção, ANTES de aplicar qualquer migration).
--
-- 100% somente leitura. Nenhuma instrução aqui cria, altera ou apaga nada.
-- O objetivo é responder, com dados reais, as perguntas que esta rodada de
-- hardening não pode responder sem acesso ao banco: as tabelas já existem?
-- com que forma? já há dado que violaria uma constraint nova? já existe
-- alguma policy/grant/function com o mesmo nome, de uma origem diferente?
--
-- Rode cada bloco separadamente e leia o resultado antes de decidir aplicar
-- 20260905120000_baseline_schema.sql em diante.

-- =============================================================================
-- 1. Quais das tabelas esperadas já existem, e com quantas linhas?
--    Se uma tabela abaixo já existir, "create table if not exists" na
--    baseline será um NO-OP — colunas/constraints da baseline NÃO serão
--    aplicadas retroativamente. Isso é intencional (a baseline nunca altera
--    tabela existente), mas significa que a forma real da tabela pode
--    divergir da baseline sem que a migration avise.
-- =============================================================================
select
  t.table_name,
  case when c.oid is not null then 'existe' else 'não existe (será criada)' end as status
from (values
  ('role'), ('company'), ('user_company_role'), ('unit'), ('professional'),
  ('service'), ('professional_service'), ('client'), ('appointment'),
  ('appointment_service'), ('attendance'), ('attendance_item')
) as t(table_name)
left join pg_class c
  on c.relname = t.table_name
  and c.relnamespace = 'public'::regnamespace;

-- =============================================================================
-- 2. Para cada tabela que já existe, quais colunas ela tem de fato?
--    Compare manualmente com as colunas de cada CREATE TABLE em
--    20260905120000_baseline_schema.sql. Se uma tabela existente estiver
--    faltando uma coluna que a baseline esperaria (ex.: company_id em
--    alguma tabela), os triggers/policies das migrations seguintes vão
--    falhar ao referenciá-la — de forma segura (a migration inteira não
--    aplica, sem dado perdido), mas vale saber antes.
-- =============================================================================
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'role', 'company', 'user_company_role', 'unit', 'professional',
    'service', 'professional_service', 'client', 'appointment',
    'appointment_service', 'attendance', 'attendance_item'
  )
order by table_name, ordinal_position;

-- =============================================================================
-- 3. role: a baseline faz `insert into role (key, name) ... on conflict
--    (key) do nothing`. Isso só funciona se a tabela (quando já existente)
--    tiver uma coluna `key` com constraint UNIQUE. Confirme aqui.
-- =============================================================================
select conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.role'::regclass;
-- Se a tabela public.role ainda não existir, esta query falha com
-- "relation does not exist" — nesse caso não há nada para verificar, a
-- baseline vai criá-la do zero com a constraint correta.

-- =============================================================================
-- 4. appointment_service: risco real da baseline. A migration adiciona
--    `exclude using gist (professional_id with =, tstzrange(...) with &&)
--    where (is_active)`. Postgres valida TODA a tabela ao adicionar essa
--    constraint — se já existirem dois registros ativos do mesmo
--    profissional com horários sobrepostos, a instrução falha (com segurança
--    — a transação da migration inteira faz rollback, nenhum dado é
--    alterado — mas a migration não vai aplicar até isso ser resolvido).
--    Esta query mostra exatamente quais pares colidiriam.
-- =============================================================================
select
  a.id as appointment_service_id_a,
  b.id as appointment_service_id_b,
  a.professional_id,
  a.starts_at as a_starts_at, a.ends_at as a_ends_at,
  b.starts_at as b_starts_at, b.ends_at as b_ends_at
from public.appointment_service a
join public.appointment_service b
  on a.professional_id = b.professional_id
  and a.id < b.id
  and a.is_active and b.is_active
  and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(b.starts_at, b.ends_at, '[)');
-- Se esta query não existir (tabela ainda não criada) ou não retornar
-- nenhuma linha, a constraint de exclusão vai aplicar sem problema.
-- Se retornar linhas, resolva os conflitos (ou marque um dos dois como
-- is_active = false) antes de aplicar a baseline.

-- =============================================================================
-- 5. Já existem policies com os mesmos nomes que as migrations vão criar?
--    Não é um bloqueio — toda policy nova é precedida de
--    `drop policy if exists`, então o nome exato é substituído com
--    segurança. O risco real é o OPOSTO: uma policy com OUTRO nome, mais
--    permissiva, pode continuar coexistindo (policies em Postgres são
--    OR'ed) mesmo depois de aplicar as migrations. Liste tudo que já existe
--    e avalie se algo além do que as migrations criam deveria ser removido.
-- =============================================================================
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'role', 'company', 'user_company_role', 'unit', 'professional',
    'service', 'professional_service', 'client', 'appointment',
    'appointment_service', 'attendance', 'attendance_item'
  )
order by tablename, policyname;

-- =============================================================================
-- 6. RLS já está habilitada nessas tabelas hoje?
--    (a migration 20260905120100 habilita explicitamente em todas — esta
--    query só mostra o estado ANTES de aplicar, útil para saber se alguma
--    tabela está rodando hoje sem RLS nenhuma.)
-- =============================================================================
select relname as table_name, relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in (
    'role', 'company', 'user_company_role', 'unit', 'professional',
    'service', 'professional_service', 'client', 'appointment',
    'appointment_service', 'attendance', 'attendance_item'
  );

-- =============================================================================
-- 7. anon ou public têm algum grant direto nessas tabelas hoje?
--    As migrations desta auditoria NUNCA concedem nada a anon/public — só a
--    authenticated. Se esta query retornar algo para anon/public, é uma
--    exposição PRÉ-EXISTENTE que as migrations não vão corrigir sozinhas
--    (não revogamos privilégio que não concedemos). Decida deliberadamente
--    se precisa de um REVOKE explícito numa migration própria.
-- =============================================================================
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'public')
  and table_name in (
    'role', 'company', 'user_company_role', 'unit', 'professional',
    'service', 'professional_service', 'client', 'appointment',
    'appointment_service', 'attendance', 'attendance_item'
  );

-- =============================================================================
-- 8. Já existem funções com os mesmos nomes que esta auditoria cria/altera?
--    `create or replace function` sobrescreve o corpo mantendo o mesmo
--    nome+assinatura — se alguma dessas funções já existir com uma
--    assinatura DIFERENTE (outros parâmetros), o CREATE OR REPLACE falha em
--    vez de criar uma segunda versão, então isso é seguro por padrão; mas
--    vale saber se algo com o mesmo nome já está em uso por outro motivo.
-- =============================================================================
select proname, pg_get_function_identity_arguments(oid) as args, prosecdef as security_definer
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'my_company_ids', 'create_company_with_owner',
    'check_professional_service_same_company',
    'check_appointment_service_same_company',
    'check_attendance_item_same_company',
    'check_appointment_same_company',
    'check_attendance_same_company',
    'prevent_attendance_item_edit_after_completion'
  );

-- =============================================================================
-- 9. (migration 20260907090000) appointment_status_check hoje: exatamente
--    qual constraint está aplicada e como se chama?
--    A migration faz `drop constraint if exists appointment_status_check`
--    e recria com o mesmo nome incluindo 'arrived'. Isso só substitui a
--    constraint de verdade se ela já se chamar exatamente
--    "appointment_status_check" (o nome padrão que o Postgres dá a um
--    `check` inline sem nome explícito). Se a constraint em produção tiver
--    outro nome, o DROP vira NO-OP e a nova constraint passa a coexistir
--    com a antiga — como Postgres aplica todos os checks com AND, uma linha
--    com status = 'arrived' violaria a constraint antiga (que não conhece
--    esse valor) mesmo satisfazendo a nova. Confirme o nome antes de aplicar.
-- =============================================================================
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.appointment'::regclass
  and contype = 'c';

-- =============================================================================
-- 10. (migration 20260907090100) supabase_realtime: essas quatro tabelas já
--    são membros da publication?
--    A migration já adiciona cada tabela individualmente, condicionada a
--    ainda não ser membro (é segura de rodar mesmo que alguma já esteja na
--    publication) — esta query é só informativa, para saber de antemão o
--    que já está habilitado hoje.
-- =============================================================================
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('appointment', 'appointment_service', 'attendance', 'attendance_item');
