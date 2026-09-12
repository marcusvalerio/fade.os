-- R15 — Infrastructure, security and performance hardening.
--
-- Fecha os achados confirmados pela auditoria R14 (read-only). Nada aqui
-- muda regra de negócio, contrato de RPC, RLS de isolamento ou comportamento
-- público — é fixação de search_path, redução de superfície de EXECUTE em
-- funções que nunca são chamadas diretamente pelo app, índices em FKs/
-- company_id já identificadas como não cobertas, e reescrita de 4 policies
-- para não reavaliar auth.uid() por linha (mesma semântica, plano melhor).
--
-- Tabelas legado (houses/profiles/servicos/clientes/agendamentos/
-- atendimentos/caixa_movimentos/caixa_fechamentos/estoque/
-- estoque_movimentos) e a duplicidade histórica do ledger de migrations
-- ficam intocadas nesta rodada, como pedido.

-- ---------------------------------------------------------------------------
-- 1. SECURITY DEFINER residual sem search_path fixado
-- ---------------------------------------------------------------------------
-- Único ajuste: fixar search_path. Corpo, assinatura e retorno das duas
-- funções não mudam.
alter function public.meu_house_id() set search_path = public, pg_temp;
alter function public.meu_role() set search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 2. Grants — reduzir EXECUTE de funções internas que não são chamadas
--    diretamente pelo frontend nem precisam ser (verificado: cada uma só é
--    invocada de dentro de outra função SECURITY DEFINER, que roda como o
--    owner e portanto nunca depende de grant explícito para chamá-las).
-- ---------------------------------------------------------------------------

-- Funções de trigger puras (retorno `trigger`): a execução do trigger nunca
-- depende do papel que disparou o INSERT/UPDATE ter EXECUTE na função —
-- revogar aqui não afeta nenhum trigger existente.
--
-- Cada uma delas recebeu, nalguma migration anterior, um GRANT EXECUTE
-- explícito para anon/authenticated (não só o PUBLIC implícito) — por isso
-- o revoke precisa nomear os três: PUBLIC e os dois papéis, senão o grant
-- direto sobrevive ao revoke de PUBLIC.
revoke execute on function public.assert_admin_write() from public, anon, authenticated;
revoke execute on function public.assert_cash_movement_session_open() from public, anon, authenticated;
revoke execute on function public.assert_payment_has_open_cash_session() from public, anon, authenticated;
revoke execute on function public.audit_price_change() from public, anon, authenticated;
revoke execute on function public.check_appointment_same_company() from public, anon, authenticated;
revoke execute on function public.check_appointment_service_same_company() from public, anon, authenticated;
revoke execute on function public.check_attendance_same_company() from public, anon, authenticated;
revoke execute on function public.check_cash_register_same_company() from public, anon, authenticated;
revoke execute on function public.check_consumable_same_company() from public, anon, authenticated;
revoke execute on function public.check_product_same_company() from public, anon, authenticated;
revoke execute on function public.check_professional_access_same_company() from public, anon, authenticated;
revoke execute on function public.check_professional_service_same_company() from public, anon, authenticated;
revoke execute on function public.check_professional_unit_same_company() from public, anon, authenticated;
revoke execute on function public.enforce_attendance_item_integrity() from public, anon, authenticated;
revoke execute on function public.prevent_attendance_item_edit_after_completion() from public, anon, authenticated;
revoke execute on function public.sync_appointment_service_active() from public, anon, authenticated;

-- Helpers com argumentos, usados só internamente por outras SECURITY
-- DEFINER (confirmado via pg_get_functiondef de cada chamadora: adjust_stock,
-- cancel_sale, close_attendance, create_pdv_sale usam apply_stock_delta;
-- add_attendance_*_item, close_attendance e update_attendance_item usam
-- authorize_operation; enable/reset_professional_access usam os dois
-- geradores; praticamente todo RPC de escrita usa write_audit_log). Mesma
-- observação: revogar de public, anon e authenticated explicitamente.
revoke execute on function public.apply_stock_delta(uuid, uuid, text, uuid, numeric) from public, anon, authenticated;
revoke execute on function public.authorize_operation(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.generate_temporary_password() from public, anon, authenticated;
revoke execute on function public.generate_unique_access_identifier() from public, anon, authenticated;
revoke execute on function public.write_audit_log(uuid, text, text, uuid, jsonb, jsonb, text) from public, anon, authenticated;

-- Helpers de RLS chamados só por policies com roles={authenticated} em
-- tabelas CORE (confirmado: nenhuma policy com roles={public}/anon depende
-- delas — só as tabelas legado usam meu_house_id/meu_role, que ficam fora
-- do escopo desta rodada). anon nunca precisa executá-las.
revoke execute on function public.my_company_ids() from anon;
revoke execute on function public.has_company_management_access(uuid) from anon;

-- ---------------------------------------------------------------------------
-- 3. Índices de company_id em tabelas CORE (R14, seção 10)
-- ---------------------------------------------------------------------------
create index if not exists appointment_company_id_idx on public.appointment (company_id);
create index if not exists attendance_company_id_idx on public.attendance (company_id);
create index if not exists professional_company_id_idx on public.professional (company_id);
create index if not exists service_company_id_idx on public.service (company_id);
create index if not exists unit_company_id_idx on public.unit (company_id);
create index if not exists user_company_role_company_id_idx on public.user_company_role (company_id);

-- ---------------------------------------------------------------------------
-- 4. Índices de FKs críticas sem cobertura (R14, seção 9 — só as tabelas
--    listadas como CRÍTICO; os 16 FKs de tabelas legado ficam de fora)
-- ---------------------------------------------------------------------------
create index if not exists appointment_client_id_idx on public.appointment (client_id);
create index if not exists appointment_unit_id_idx on public.appointment (unit_id);

create index if not exists attendance_client_id_idx on public.attendance (client_id);
create index if not exists attendance_unit_id_idx on public.attendance (unit_id);
create index if not exists attendance_origin_appointment_id_idx on public.attendance (origin_appointment_id);

create index if not exists attendance_item_attendance_id_idx on public.attendance_item (attendance_id);
create index if not exists attendance_item_product_id_idx on public.attendance_item (product_id);
create index if not exists attendance_item_service_id_idx on public.attendance_item (service_id);

create index if not exists professional_user_id_idx on public.professional (user_id);

create index if not exists user_company_role_role_id_idx on public.user_company_role (role_id);

create index if not exists sale_item_attendance_item_id_idx on public.sale_item (attendance_item_id);
create index if not exists sale_item_product_id_idx on public.sale_item (product_id);
create index if not exists sale_item_service_id_idx on public.sale_item (service_id);

create index if not exists cash_session_unit_id_idx on public.cash_session (unit_id);
create index if not exists financial_entry_unit_id_idx on public.financial_entry (unit_id);
create index if not exists stock_movement_unit_id_idx on public.stock_movement (unit_id);

create index if not exists professional_service_service_id_idx on public.professional_service (service_id);

create index if not exists appointment_service_appointment_id_idx on public.appointment_service (appointment_id);
create index if not exists appointment_service_service_id_idx on public.appointment_service (service_id);

-- ---------------------------------------------------------------------------
-- 5. RLS performance — (select auth.<fn>()) em vez de reavaliar por linha.
--    Mesma condição, plano de execução melhor. Não altera quem tem acesso a
--    quê. `profiles` (legado) fica de fora — congelado nesta rodada.
-- ---------------------------------------------------------------------------
alter policy app_user_select_self on public.app_user
  using (id = (select auth.uid()));

alter policy app_user_update_self on public.app_user
  using (id = (select auth.uid()));

alter policy user_company_role_select on public.user_company_role
  using (user_id = (select auth.uid()));

alter policy professional_access_select on public.professional_access
  using (
    has_company_management_access(company_id)
    or exists (
      select 1 from public.professional p
      where p.id = professional_access.professional_id
        and p.user_id = (select auth.uid())
    )
  );
