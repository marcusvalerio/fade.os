-- FADE OS — Teste operacional, P1 #5: a trilha de auditoria era falsificável.
--
-- PROBLEMA (reproduzido): `audit_log` tinha INSERT e UPDATE concedidos a
-- `authenticated`, com policies escopadas apenas por empresa. Um `staff`
-- conseguia, com um POST direto no PostgREST:
--
--   insert into audit_log (company_id, action, entity_type, entity_id)
--   values (<sua empresa>, 'ACAO_FORJADA_PELO_STAFF', 'sale', ...)
--
-- Medido: PERMITIDO. E como o próprio código de autorização (desconto,
-- cortesia, cancelamento, regeneração de código) registra as operações
-- sensíveis aqui, uma trilha que qualquer pessoa pode escrever à mão não
-- prova nada — nem o que aconteceu, nem quem fez.
--
-- A correção é a de sempre: a escrita sai do alcance do cliente e passa a
-- existir só dentro de uma função que deriva ator e empresa da sessão.
--
-- Não é destrutivo: nenhuma linha existente é alterada ou removida.

-- ---------------------------------------------------------------------------
-- 1. write_audit_log passa a ser a única porta de escrita
-- ---------------------------------------------------------------------------
-- Vira SECURITY DEFINER porque é justamente o INSERT de `authenticated` que
-- estamos revogando abaixo — sem isso, todo caminho que audita (close_attendance,
-- create_pdv_sale, close_cash_session, adjust_stock, que são SECURITY INVOKER)
-- pararia de funcionar.
--
-- Ganhar o privilégio do dono exige devolver as duas checagens que o RLS fazia:
--
--   - ator: `user_id` continua vindo de auth.uid(), nunca de parâmetro. Não
--     existe forma de registrar um evento em nome de outra pessoa;
--   - empresa: p_company_id precisa estar entre as empresas do chamador, senão
--     um membro da empresa A poderia poluir a trilha da empresa B.
--
-- Todos os chamadores atuais são fluxos autenticados (adjust_stock,
-- authorize_operation, cancel_sale, close_attendance, close_cash_session,
-- create_pdv_sale, mark_commission_paid, regenerate_authorization_code).
-- Nenhuma função pública/anônima audita, então exigir auth.uid() não quebra
-- a página pública de agendamento.
create or replace function public.write_audit_log(
  p_company_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_stack text;
begin
  -- Ela precisa continuar executável por `authenticated`, porque quem audita
  -- são funções SECURITY INVOKER (close_attendance, create_pdv_sale,
  -- adjust_stock, close_cash_session) que rodam com o privilégio de quem
  -- vende. Só que isso deixava um POST direto em /rpc/write_audit_log
  -- inventar eventos na trilha da própria empresa — um "cancel_sale" sem
  -- venda nenhuma. A pilha de chamada separa os dois casos: pelo PostgREST a
  -- função é o único frame plpgsql; chamada de dentro de outra função, são
  -- dois ou mais.
  get diagnostics v_stack = pg_context;
  if array_length(string_to_array(v_stack, 'PL/pgSQL function'), 1) - 1 < 2 then
    raise exception 'AUDITORIA_NAO_CHAMAVEL_DIRETAMENTE' using errcode = '42501';
  end if;

  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if p_company_id is null or p_company_id not in (select public.my_company_ids()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_action is null or length(btrim(p_action)) = 0 then
    raise exception 'ACAO_OBRIGATORIA' using errcode = '22023';
  end if;

  insert into public.audit_log (company_id, user_id, action, entity_type, entity_id, before, after, reason)
  values (p_company_id, auth.uid(), p_action, p_entity_type, p_entity_id, p_before, p_after, p_reason)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.write_audit_log(uuid, text, text, uuid, jsonb, jsonb, text) from public, anon;
grant execute on function public.write_audit_log(uuid, text, text, uuid, jsonb, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Fechar a escrita direta
-- ---------------------------------------------------------------------------
-- INSERT sai junto com UPDATE e DELETE: append-only não significa "qualquer
-- um pode acrescentar", significa que o que entrou entrou por um caminho
-- confiável e não sai mais.
revoke insert, update, delete on public.audit_log from authenticated, anon;
drop policy if exists audit_log_insert on public.audit_log;
drop policy if exists audit_log_update on public.audit_log;

-- Leitura passa a ser de gestão. A trilha registra desconto, cortesia,
-- cancelamento e ajuste de estoque — é material de owner/admin, e nenhuma
-- tela do app lê esta tabela hoje (verificado: zero referências a `audit_log`
-- em app/, actions/, lib/ e components/).
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (public.has_company_management_access(company_id));
