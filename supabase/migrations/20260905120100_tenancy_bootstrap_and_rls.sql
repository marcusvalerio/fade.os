-- FADE OS — tenancy bootstrap fix + full RLS hardening
--
-- PROBLEMA CORRIGIDO AQUI
-- ------------------------
-- company_select exige `id in (select my_company_ids())`, e my_company_ids()
-- é `select company_id from user_company_role where user_id = auth.uid()`.
-- Um usuário recém-criado ainda não tem nenhuma linha em user_company_role,
-- então my_company_ids() não retorna nada — e se user_company_role_insert
-- também exigir `company_id in (select my_company_ids())`, o primeiro
-- vínculo nunca pode ser criado (ciclo: para ganhar acesso à empresa você já
-- precisa ter acesso à empresa).
--
-- A correção NÃO é abrir RLS (WITH CHECK (true), liberar tudo para
-- authenticated etc.) nem desabilitar RLS. A correção é dar ao onboarding
-- um caminho de bootstrap explícito e auditável: uma função RPC
-- SECURITY DEFINER (create_company_with_owner) que cria a empresa e o
-- vínculo owner na mesma transação, rodando com o privilégio do dono da
-- função — não do usuário — e validando explicitamente que:
--   * o chamador está autenticado (auth.uid() is not null);
--   * user_id do vínculo é sempre auth.uid() (nunca vem do cliente);
--   * company_id do vínculo é sempre a empresa que a própria função acabou
--     de criar (nunca um id arbitrário vindo do cliente).
--
-- O INSERT direto em company/user_company_role continua bloqueado para
-- `authenticated` (grant revogado abaixo) — só a função pode escrever
-- nessas duas tabelas na criação inicial. Isso fecha exatamente o vetor
-- descrito na seção 20 do pedido: um usuário não pode, alterando o
-- company_id que envia pro servidor, associar-se a uma empresa de terceiros.

-- ---------------------------------------------------------------------------
-- my_company_ids(): auditada e endurecida
--   - SECURITY DEFINER com search_path fixo (evita hijack de search_path);
--   - STABLE (é usada dentro de policies, então precisa ser barata e sem
--     efeitos colaterais);
--   - EXECUTE restrito a authenticated (nunca a `anon` ou `public`).
-- ---------------------------------------------------------------------------
create or replace function public.my_company_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select company_id
  from public.user_company_role
  where user_id = auth.uid();
$$;

revoke all on function public.my_company_ids() from public;
grant execute on function public.my_company_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- create_company_with_owner(): bootstrap atômico de tenancy
--
-- AUTHENTICATED USER -> CREATE COMPANY -> CREATE USER_COMPANY_ROLE (owner)
-- em uma única transação de função: se qualquer passo falhar, nada é
-- gravado (rollback automático de exceção em plpgsql).
-- ---------------------------------------------------------------------------
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
  v_company public.company;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if coalesce(btrim(p_name), '') = '' then
    raise exception 'COMPANY_NAME_REQUIRED' using errcode = '22023';
  end if;

  select id into v_owner_role_id from public.role where key = 'owner';
  if v_owner_role_id is null then
    raise exception 'OWNER_ROLE_MISSING';
  end if;

  insert into public.company (name, trade_name, document, phone, email, address, created_by)
  values (p_name, p_trade_name, p_document, p_phone, p_email, p_address, v_user_id)
  returning * into v_company;

  insert into public.user_company_role (user_id, company_id, role_id)
  values (v_user_id, v_company.id, v_owner_role_id);

  return v_company;
end;
$$;

revoke all on function public.create_company_with_owner(text, text, text, text, text, text) from public;
grant execute on function public.create_company_with_owner(text, text, text, text, text, text) to authenticated;

-- Fecha o caminho direto: só a função (rodando com o privilégio do seu
-- dono) pode inserir em company / user_company_role. Isso impede qualquer
-- INSERT direto do cliente nessas duas tabelas, mesmo que alguém tente
-- chamar supabase.from("company").insert(...) manualmente.
revoke insert on public.company from authenticated;
revoke insert, update, delete on public.user_company_role from authenticated;

-- ---------------------------------------------------------------------------
-- RLS: habilitar em todas as tabelas de tenancy
-- ---------------------------------------------------------------------------
alter table public.role enable row level security;
alter table public.company enable row level security;
alter table public.user_company_role enable row level security;
alter table public.unit enable row level security;
alter table public.professional enable row level security;
alter table public.service enable row level security;
alter table public.professional_service enable row level security;
alter table public.client enable row level security;
alter table public.appointment enable row level security;
alter table public.appointment_service enable row level security;
alter table public.attendance enable row level security;
alter table public.attendance_item enable row level security;

-- role: tabela de referência, leitura liberada para qualquer usuário
-- autenticado (não carrega dado de nenhum tenant).
drop policy if exists role_select on public.role;
create policy role_select on public.role
  for select to authenticated
  using (true);

-- company: só quem tem vínculo enxerga. Sem policy de insert para
-- `authenticated` — a criação é exclusiva da RPC acima (SECURITY DEFINER
-- roda como o dono da função e por isso não passa pelas policies de RLS
-- do usuário comum).
drop policy if exists company_select on public.company;
create policy company_select on public.company
  for select to authenticated
  using (id in (select public.my_company_ids()));

-- user_company_role: cada usuário só vê seus próprios vínculos (suficiente
-- para o app hoje: seletor de empresa ativa e checagem de papel). Sem
-- policy de insert/update/delete para `authenticated` pelo mesmo motivo
-- acima — qualquer gestão de equipe futura (convidar usuário, trocar
-- papel) precisa de uma nova RPC auditada, não de INSERT/UPDATE livre.
drop policy if exists user_company_role_select on public.user_company_role;
create policy user_company_role_select on public.user_company_role
  for select to authenticated
  using (user_id = auth.uid());

-- unit / professional / service / client / appointment / attendance:
-- isolamento padrão por company_id.
drop policy if exists unit_select on public.unit;
create policy unit_select on public.unit
  for select to authenticated
  using (company_id in (select public.my_company_ids()));

drop policy if exists unit_insert on public.unit;
create policy unit_insert on public.unit
  for insert to authenticated
  with check (company_id in (select public.my_company_ids()));

drop policy if exists professional_select on public.professional;
create policy professional_select on public.professional
  for select to authenticated
  using (company_id in (select public.my_company_ids()));

drop policy if exists professional_insert on public.professional;
create policy professional_insert on public.professional
  for insert to authenticated
  with check (company_id in (select public.my_company_ids()));

drop policy if exists professional_update on public.professional;
create policy professional_update on public.professional
  for update to authenticated
  using (company_id in (select public.my_company_ids()))
  with check (company_id in (select public.my_company_ids()));

drop policy if exists service_select on public.service;
create policy service_select on public.service
  for select to authenticated
  using (company_id in (select public.my_company_ids()));

drop policy if exists service_insert on public.service;
create policy service_insert on public.service
  for insert to authenticated
  with check (company_id in (select public.my_company_ids()));

drop policy if exists service_update on public.service;
create policy service_update on public.service
  for update to authenticated
  using (company_id in (select public.my_company_ids()))
  with check (company_id in (select public.my_company_ids()));

drop policy if exists client_select on public.client;
create policy client_select on public.client
  for select to authenticated
  using (company_id in (select public.my_company_ids()));

drop policy if exists client_insert on public.client;
create policy client_insert on public.client
  for insert to authenticated
  with check (company_id in (select public.my_company_ids()));

drop policy if exists client_update on public.client;
create policy client_update on public.client
  for update to authenticated
  using (company_id in (select public.my_company_ids()))
  with check (company_id in (select public.my_company_ids()));

drop policy if exists appointment_select on public.appointment;
create policy appointment_select on public.appointment
  for select to authenticated
  using (company_id in (select public.my_company_ids()));

drop policy if exists appointment_insert on public.appointment;
create policy appointment_insert on public.appointment
  for insert to authenticated
  with check (company_id in (select public.my_company_ids()));

drop policy if exists appointment_update on public.appointment;
create policy appointment_update on public.appointment
  for update to authenticated
  using (company_id in (select public.my_company_ids()))
  with check (company_id in (select public.my_company_ids()));

drop policy if exists appointment_delete on public.appointment;
create policy appointment_delete on public.appointment
  for delete to authenticated
  using (company_id in (select public.my_company_ids()));

drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance
  for select to authenticated
  using (company_id in (select public.my_company_ids()));

drop policy if exists attendance_insert on public.attendance;
create policy attendance_insert on public.attendance
  for insert to authenticated
  with check (company_id in (select public.my_company_ids()));

drop policy if exists attendance_update on public.attendance;
create policy attendance_update on public.attendance
  for update to authenticated
  using (company_id in (select public.my_company_ids()))
  with check (company_id in (select public.my_company_ids()));

-- professional_service: não tem company_id próprio — o tenant é herdado
-- do profissional (a trigger já garante que profissional e serviço são da
-- mesma empresa).
drop policy if exists professional_service_select on public.professional_service;
create policy professional_service_select on public.professional_service
  for select to authenticated
  using (
    exists (
      select 1 from public.professional p
      where p.id = professional_service.professional_id
        and p.company_id in (select public.my_company_ids())
    )
  );

drop policy if exists professional_service_insert on public.professional_service;
create policy professional_service_insert on public.professional_service
  for insert to authenticated
  with check (
    exists (
      select 1 from public.professional p
      where p.id = professional_service.professional_id
        and p.company_id in (select public.my_company_ids())
    )
    and exists (
      select 1 from public.service s
      where s.id = professional_service.service_id
        and s.company_id in (select public.my_company_ids())
    )
  );

drop policy if exists professional_service_delete on public.professional_service;
create policy professional_service_delete on public.professional_service
  for delete to authenticated
  using (
    exists (
      select 1 from public.professional p
      where p.id = professional_service.professional_id
        and p.company_id in (select public.my_company_ids())
    )
  );

-- appointment_service: tenant herdado do appointment.
drop policy if exists appointment_service_select on public.appointment_service;
create policy appointment_service_select on public.appointment_service
  for select to authenticated
  using (
    exists (
      select 1 from public.appointment a
      where a.id = appointment_service.appointment_id
        and a.company_id in (select public.my_company_ids())
    )
  );

drop policy if exists appointment_service_insert on public.appointment_service;
create policy appointment_service_insert on public.appointment_service
  for insert to authenticated
  with check (
    exists (
      select 1 from public.appointment a
      where a.id = appointment_service.appointment_id
        and a.company_id in (select public.my_company_ids())
    )
  );

drop policy if exists appointment_service_update on public.appointment_service;
create policy appointment_service_update on public.appointment_service
  for update to authenticated
  using (
    exists (
      select 1 from public.appointment a
      where a.id = appointment_service.appointment_id
        and a.company_id in (select public.my_company_ids())
    )
  )
  with check (
    exists (
      select 1 from public.appointment a
      where a.id = appointment_service.appointment_id
        and a.company_id in (select public.my_company_ids())
    )
  );

-- attendance_item: tenant herdado do attendance.
drop policy if exists attendance_item_select on public.attendance_item;
create policy attendance_item_select on public.attendance_item
  for select to authenticated
  using (
    exists (
      select 1 from public.attendance at
      where at.id = attendance_item.attendance_id
        and at.company_id in (select public.my_company_ids())
    )
  );

drop policy if exists attendance_item_insert on public.attendance_item;
create policy attendance_item_insert on public.attendance_item
  for insert to authenticated
  with check (
    exists (
      select 1 from public.attendance at
      where at.id = attendance_item.attendance_id
        and at.company_id in (select public.my_company_ids())
    )
  );

drop policy if exists attendance_item_update on public.attendance_item;
create policy attendance_item_update on public.attendance_item
  for update to authenticated
  using (
    exists (
      select 1 from public.attendance at
      where at.id = attendance_item.attendance_id
        and at.company_id in (select public.my_company_ids())
    )
  )
  with check (
    exists (
      select 1 from public.attendance at
      where at.id = attendance_item.attendance_id
        and at.company_id in (select public.my_company_ids())
    )
  );
