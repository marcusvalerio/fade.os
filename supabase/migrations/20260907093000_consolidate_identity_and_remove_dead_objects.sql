-- FADE OS — consolidação final: identidade direta em auth.users e remoção
-- de objetos mortos deixados pelas fases anteriores do projeto.
--
-- CONTEXTO
-- As migrations 20260905120000/120100/120200 e 20260906090000 desenharam o
-- schema/RLS/bootstrap corretos, mas foram escritas como se o banco fosse
-- criado do zero (CREATE TABLE IF NOT EXISTS). O banco real já existia com
-- uma forma anterior de algumas tabelas (uma tabela `app_user` espelhando
-- auth.users, company/professional/user_company_role apontando para
-- app_user em vez de auth.users diretamente, uma coluna unit_scope não
-- mais usada por nenhuma policy ou action). Esta migration fecha essa
-- divergência entre "schema desejado" e "schema real".
--
-- Também remove objetos que ficaram sem uso depois da consolidação:
--   - tabela `sale`: nenhuma action ou tela referencia; a camada
--     comercial (sale/payment/caixa/comissão) ainda não existe no domínio
--     atual (Product Blueprint seção 6 do pedido de consolidação), então
--     mantê-la seria "tabela futura sem uso".
--   - tabelas `permission`/`role_permission`: catálogo de permissões
--     granulares que nenhum código lê hoje (autorização atual é só
--     owner/admin/staff via user_company_role, sem granularidade por
--     ação). Continham apenas dados de catálogo que eu mesmo semeei numa
--     fase anterior, não dados de negócio do usuário.
--   - funções/triggers de um bootstrap anterior (trigger em auth.users e
--     em company) substituídos pela função RPC create_company_with_owner.
--   - trigger que criava uma `sale` automaticamente ao concluir um
--     atendimento — dependia da tabela `sale`, removida.
--   - trigger que calculava comissão automaticamente no INSERT do item —
--     nenhuma action popula commission_percent_snapshot/commission_amount
--     hoje; as colunas continuam no schema para quando essa lógica for
--     implementada de fato, mas o cálculo automático ficou órfão.
--   - my_unit_ids(): escopo por unidade dentro de uma empresa não existe
--     mais em nenhuma policy nem em nenhuma action (tenancy é só por
--     empresa hoje).
--
-- NÃO REMOVIDO NESTA MIGRATION (ver relatório da tarefa):
--   - tabela `app_user`: contém 1 linha de dado real (o próprio cadastro
--     do usuário). A informação já está integralmente em auth.users
--     (nome vem de raw_user_meta_data, e-mail do próprio auth.users), mas
--     a remoção da TABELA em si fica para uma migration futura explícita,
--     depois de confirmação — esta migration só a desconecta (nenhuma FK
--     aponta mais para ela).
--   - cluster de prototipagem antigo (houses/profiles/clientes/servicos/
--     agendamentos/atendimentos/estoque*/caixa_*) e suas funções
--     (meu_house_id/meu_role/registrar_entrada_caixa/atualizar_stats_
--     cliente): sistema totalmente isolado do domínio atual (zero FK
--     cruzada com as tabelas do FADE OS), mas `houses` tem 1 linha de
--     dado real ("Degrade Barber House", criada em 2026-07-11) — regra
--     da tarefa exige pausar e reportar antes de apagar dado real, não
--     apagar silenciosamente.

-- ---------------------------------------------------------------------------
-- 1. Repontar identidade para auth.users diretamente (app_user deixa de
--    ser referenciado por qualquer FK, mas a tabela em si é preservada).
-- ---------------------------------------------------------------------------
alter table public.company
  drop constraint if exists company_created_by_fkey;
alter table public.company
  add constraint company_created_by_fkey foreign key (created_by) references auth.users (id);

alter table public.professional
  drop constraint if exists professional_user_id_fkey;
alter table public.professional
  add constraint professional_user_id_fkey foreign key (user_id) references auth.users (id);

alter table public.user_company_role
  drop constraint if exists user_company_role_user_id_fkey;
alter table public.user_company_role
  add constraint user_company_role_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 2. unit_scope nunca foi lido por nenhuma policy ou action nesta fase do
--    projeto (tenancy é por empresa, não por unidade dentro da empresa) —
--    remove a coluna e simplifica a constraint de unicidade de acordo.
-- ---------------------------------------------------------------------------
alter table public.user_company_role
  drop constraint if exists user_company_role_user_id_company_id_role_id_key;
alter table public.user_company_role
  drop column if exists unit_scope;
alter table public.user_company_role
  add constraint user_company_role_user_id_company_id_key unique (user_id, company_id);

-- ---------------------------------------------------------------------------
-- 3. company.settings: coluna jsonb sem leitor/escritor em nenhuma action
--    ou policy atual.
-- ---------------------------------------------------------------------------
alter table public.company drop column if exists settings;

-- ---------------------------------------------------------------------------
-- 4. Bootstrap antigo (trigger-based) — substituído pela RPC
--    create_company_with_owner, que já roda em produção desde a migration
--    20260905120100.
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_auth_user();

drop trigger if exists on_company_created on public.company;
drop function if exists public.handle_new_company();

-- ---------------------------------------------------------------------------
-- 5. Trigger que criava uma `sale` automaticamente — dependia da tabela
--    `sale`, que está sendo removida por não fazer parte do domínio atual.
-- ---------------------------------------------------------------------------
drop trigger if exists on_attendance_completed on public.attendance;
drop function if exists public.handle_attendance_completed();

-- ---------------------------------------------------------------------------
-- 6. Cálculo automático de comissão no INSERT — órfão: nenhuma action
--    depende dele, e a trava de imutabilidade correta pós-conclusão já é
--    a trg_attendance_item_immutable (baseline_schema). O guard de UPDATE
--    que recalculava comissão no ato de editar também fica sem função,
--    pelo mesmo motivo.
-- ---------------------------------------------------------------------------
drop trigger if exists on_attendance_item_insert on public.attendance_item;
drop function if exists public.calculate_attendance_item_commission();

drop trigger if exists on_attendance_item_update on public.attendance_item;
drop function if exists public.guard_attendance_item_update();

drop trigger if exists on_attendance_cancel_guard on public.attendance;
drop function if exists public.guard_attendance_cancel();

-- ---------------------------------------------------------------------------
-- 7. Escopo por unidade dentro da empresa não existe mais em nenhuma
--    policy — função órfã.
-- ---------------------------------------------------------------------------
drop function if exists public.my_unit_ids(uuid);

-- ---------------------------------------------------------------------------
-- 8. Tabelas mortas do domínio atual do FADE OS (zero linhas, zero
--    referência em código).
-- ---------------------------------------------------------------------------
drop table if exists public.sale;
drop table if exists public.role_permission;
drop table if exists public.permission;

-- ---------------------------------------------------------------------------
-- 9. Papéis legados sem nenhum vínculo em user_company_role (o domínio
--    atual usa owner/admin/staff, inseridos pela baseline_schema).
-- ---------------------------------------------------------------------------
delete from public.role where key in ('manager', 'reception', 'barber');

-- ---------------------------------------------------------------------------
-- 10. Higiene de policies: as duas policies do ciclo de bootstrap
--     original ficaram órfãs assim que os GRANTs de INSERT foram
--     revogados na migration 20260905120100 — já não eram alcançáveis,
--     mas continuavam listadas em pg_policies. Removidas explicitamente
--     por clareza (seção 9 do pedido: nenhuma policy legada conflitante).
-- ---------------------------------------------------------------------------
drop policy if exists company_insert on public.company;
drop policy if exists user_company_role_insert on public.user_company_role;

-- ---------------------------------------------------------------------------
-- 11. ACHADO durante a aplicação desta migration: além de company_insert e
--     user_company_role_insert, um conjunto inteiro de policies "_write"
--     de uma fase ainda mais antiga do projeto sobreviveu às migrations
--     de tenancy hardening (que só recriaram as policies "_insert" com o
--     mesmo nome — nomes diferentes não colidem, então as duas convivem).
--     Como policies permissivas do Postgres são combinadas por OR, as
--     "_write" antigas (baseadas em my_unit_ids(), escopo por unidade)
--     ficavam efetivamente reabrindo o INSERT ao lado das "_insert" novas
--     (escopo só por empresa) — exatamente o risco descrito na seção 9 do
--     pedido. Removidas explicitamente.
-- ---------------------------------------------------------------------------
drop policy if exists appointment_write on public.appointment;
drop policy if exists appointment_service_write on public.appointment_service;
drop policy if exists attendance_write on public.attendance;
drop policy if exists attendance_item_write on public.attendance_item;
drop policy if exists client_write on public.client;
drop policy if exists professional_write on public.professional;
drop policy if exists professional_service_write on public.professional_service;
drop policy if exists service_write on public.service;
