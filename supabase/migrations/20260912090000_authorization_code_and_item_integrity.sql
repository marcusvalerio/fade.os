-- FADE OS — Auditoria final: código de autorização e integridade do item.
--
-- PROBLEMA (P0, comprovado contra o banco real antes da correção):
--
--   assert_can_change_price protegia só o desconto do FECHAMENTO e o do PDV.
--   O item do atendimento não era protegido por nada. Um usuário `staff`
--   conseguia, com três inserts:
--
--     - item de R$ 80 com desconto de R$ 79,99;
--     - produto de R$ 50 marcado como cortesia;
--     - serviço de R$ 80 gravado com original_price = R$ 1;
--
--   e fechar o atendimento COM desconto zero — assim assert_can_change_price
--   nem chegava a ser chamado. Resultado medido: R$ 210 de catálogo vendidos
--   por R$ 1,01, com o estoque baixado.
--
--   Pior: a derivação de preço vivia só na Server Action, então o mesmo
--   ataque saía por um INSERT direto no PostgREST, sem passar por nenhuma
--   linha de TypeScript.
--
-- SOLUÇÃO, em duas camadas:
--
--   1. Um trigger em attendance_item que é a autoridade final: deriva o preço
--      do catálogo, recusa desconto/cortesia sem autorização e valida
--      profissional × serviço × unidade. Vale para qualquer caminho de
--      escrita, inclusive REST direto.
--
--   2. Um código de autorização por empresa, que permite ao staff executar a
--      operação sensível SEM virar gerente. É credencial de operação, não
--      senha de administrador: autoriza exatamente a operação pedida, na
--      empresa pedida, dentro da transação em que foi apresentado.

-- ---------------------------------------------------------------------------
-- 1. O código de autorização
-- ---------------------------------------------------------------------------
create table if not exists public.company_authorization_code (
  company_id uuid primary key references public.company (id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.company_authorization_code is
  'Credencial da empresa para autorizar operações sensíveis (desconto, cortesia). Um código por empresa, guardado só como hash bcrypt. Regenerar invalida o anterior na mesma hora.';
comment on column public.company_authorization_code.code_hash is
  'bcrypt. O código em texto puro existe uma única vez, no retorno de regenerate_authorization_code, e nunca é gravado nem registrado em log ou auditoria.';

alter table public.company_authorization_code enable row level security;

-- Ninguém lê o hash pela API. A verificação acontece só dentro das funções
-- SECURITY DEFINER abaixo. Sem policy de select, propositalmente.
drop policy if exists company_authorization_code_no_direct_read on public.company_authorization_code;

revoke all on public.company_authorization_code from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Geração — owner/admin, devolvida uma única vez
-- ---------------------------------------------------------------------------
-- Alfabeto sem os pares que se confundem quando alguém dita o código em voz
-- alta ou copia de um papel (O/0, I/1, S/5): é assim que ele circula no balcão.
-- 8 caracteres sobre 31 símbolos ≈ 8,5 × 10^11 combinações, com bcrypt por
-- trás — força bruta online não é caminho viável.
create or replace function public.regenerate_authorization_code(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_chars text := 'ABCDEFGHJKLMNPQRTUVWXYZ23456789';
  v_len int := length(v_chars);
  v_bytes bytea;
  v_code text := '';
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.has_company_management_access(p_company_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  v_bytes := extensions.gen_random_bytes(8);
  for i in 0..7 loop
    v_code := v_code || substr(v_chars, (get_byte(v_bytes, i) % v_len) + 1, 1);
  end loop;

  insert into public.company_authorization_code as c (company_id, code_hash, updated_by)
  values (p_company_id, extensions.crypt(v_code, extensions.gen_salt('bf', 10)), auth.uid())
  on conflict (company_id) do update
    set code_hash = excluded.code_hash,
        updated_at = now(),
        updated_by = excluded.updated_by;

  -- Auditoria registra QUE o código foi trocado, nunca o código.
  perform public.write_audit_log(
    p_company_id, 'regenerate_authorization_code', 'company', p_company_id,
    null, jsonb_build_object('rotated_at', now()), null
  );

  return v_code;
end;
$$;

revoke all on function public.regenerate_authorization_code(uuid) from public, anon;
grant execute on function public.regenerate_authorization_code(uuid) to authenticated;

/** Só informa SE existe código configurado — nunca o valor nem o hash. */
create or replace function public.has_authorization_code(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.company_authorization_code c
    where c.company_id = p_company_id
      and public.has_company_management_access(p_company_id)
  );
$$;

revoke all on function public.has_authorization_code(uuid) from public, anon;
grant execute on function public.has_authorization_code(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Apresentação do código
-- ---------------------------------------------------------------------------
-- Marca a transação atual como autorizada para UMA operação numa UMA empresa.
-- `set_config(..., true)` é escopo de transação: apresentar o código numa
-- chamada e tentar usar noutra não funciona, porque cada requisição REST é
-- uma transação. Só a RPC que autoriza e escreve no mesmo fôlego aproveita.
create or replace function public.authorize_operation(
  p_company_id uuid,
  p_code text,
  p_operation text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_operation not in ('discount', 'courtesy') then
    raise exception 'OPERACAO_INVALIDA' using errcode = '22023';
  end if;
  -- O código não substitui o vínculo: quem não é da empresa não passa nem com
  -- o código certo.
  if not exists (
    select 1 from public.user_company_role ucr
    where ucr.user_id = auth.uid() and ucr.company_id = p_company_id
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select code_hash into v_hash
  from public.company_authorization_code
  where company_id = p_company_id;

  if v_hash is null or p_code is null
     or v_hash <> extensions.crypt(upper(btrim(p_code)), v_hash) then
    raise exception 'CODIGO_AUTORIZACAO_INVALIDO' using errcode = '42501';
  end if;

  perform set_config('fade.authorized_operation', p_operation || ':' || p_company_id::text, true);

  -- Auditoria do uso. Registra quem, quando e para qual operação — nunca o
  -- código apresentado.
  perform public.write_audit_log(
    p_company_id, 'authorize_' || p_operation, 'company', p_company_id,
    null, jsonb_build_object('authorized_at', now()), null
  );
end;
$$;

revoke all on function public.authorize_operation(uuid, text, text) from public, anon;
grant execute on function public.authorize_operation(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. O teste de autorização
-- ---------------------------------------------------------------------------
-- owner/admin passam pelo próprio papel: a credencial existe para delegar a
-- operação a quem NÃO é gerente, não para transformar gerente em digitador de
-- código.
create or replace function public.assert_operation_authorized(
  p_company_id uuid,
  p_operation text
)
returns void
language plpgsql
stable
set search_path = public, pg_temp
as $$
begin
  if public.has_company_management_access(p_company_id) then
    return;
  end if;

  if coalesce(current_setting('fade.authorized_operation', true), '')
     = p_operation || ':' || p_company_id::text then
    return;
  end if;

  if p_operation = 'courtesy' then
    raise exception 'CORTESIA_NAO_AUTORIZADA' using errcode = '42501';
  end if;
  raise exception 'DESCONTO_NAO_AUTORIZADO' using errcode = '42501';
end;
$$;

revoke all on function public.assert_operation_authorized(uuid, text) from public, anon;
grant execute on function public.assert_operation_authorized(uuid, text) to authenticated;

-- assert_can_change_price continua existindo porque close_attendance e
-- create_pdv_sale a chamam; passa a delegar, para não haver duas regras.
create or replace function public.assert_can_change_price(p_company_id uuid)
returns void
language plpgsql
stable
set search_path = public, pg_temp
as $$
begin
  perform public.assert_operation_authorized(p_company_id, 'discount');
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. O trigger: autoridade final sobre o item de atendimento
-- ---------------------------------------------------------------------------
-- Vale para QUALQUER caminho de escrita — Server Action, RPC ou INSERT direto
-- no PostgREST. É aqui que o preço deixa de ser opinião do cliente.
create or replace function public.enforce_attendance_item_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_unit_id uuid;
  v_status text;
  v_base numeric;
  v_duration int;
  v_touched_price boolean;
begin
  select a.company_id, a.unit_id, a.status
    into v_company_id, v_unit_id, v_status
    from public.attendance a
    where a.id = new.attendance_id;

  if v_company_id is null then
    raise exception 'ATENDIMENTO_NAO_ENCONTRADO' using errcode = 'P0002';
  end if;

  if tg_op = 'INSERT' then
    if v_status <> 'in_progress' then
      raise exception 'ATENDIMENTO_JA_FECHADO' using errcode = '22023';
    end if;

    if coalesce(new.quantity, 1) <= 0 then
      raise exception 'QUANTIDADE_INVALIDA' using errcode = '22023';
    end if;

    if new.kind = 'service' then
      -- Serviço ativo E da empresa.
      select s.default_price, s.planned_duration_minutes into v_base, v_duration
        from public.service s
        where s.id = new.service_id and s.company_id = v_company_id and s.status = 'active';
      if v_base is null then
        raise exception 'SERVICO_INVALIDO' using errcode = '22023';
      end if;

      -- Profissional da empresa, ativo e desta unidade. unit_id nulo
      -- significa "atende em qualquer unidade", como no motor da agenda.
      if not exists (
        select 1 from public.professional p
        where p.id = new.professional_id
          and p.company_id = v_company_id
          and p.active
          and (p.unit_id is null or p.unit_id = v_unit_id)
      ) then
        raise exception 'PROFISSIONAL_INVALIDO' using errcode = '22023';
      end if;

      -- E que de fato executa este serviço.
      if not exists (
        select 1 from public.professional_service ps
        where ps.professional_id = new.professional_id and ps.service_id = new.service_id
      ) then
        raise exception 'PROFISSIONAL_NAO_HABILITADO' using errcode = '22023';
      end if;

      new.quantity := 1;
      new.planned_duration_minutes := v_duration;

    elsif new.kind = 'product' then
      select p.sale_price into v_base
        from public.product p
        where p.id = new.product_id
          and p.company_id = v_company_id
          and p.unit_id = v_unit_id
          and p.active;
      if v_base is null then
        raise exception 'PRODUTO_INVALIDO' using errcode = '22023';
      end if;
      v_base := v_base * new.quantity;

    else
      raise exception 'TIPO_INVALIDO' using errcode = '22023';
    end if;

    -- O preço é sempre o do catálogo. Qualquer valor que tenha vindo no
    -- payload é descartado aqui.
    new.original_price := v_base;
    v_touched_price := true;

  else
    -- UPDATE. O preço congelado no início do atendimento não se mexe: um
    -- reajuste de catálogo não pode reescrever atendimento em andamento, e
    -- ninguém reescreve original_price para inventar desconto.
    if new.original_price is distinct from old.original_price then
      raise exception 'PRECO_ORIGINAL_IMUTAVEL' using errcode = '22023';
    end if;
    v_base := old.original_price;

    -- close_attendance grava commission_percent_snapshot/commission_amount
    -- neste mesmo item. Isso não é mexer em preço e não exige autorização.
    v_touched_price :=
      new.discount is distinct from old.discount
      or new.type is distinct from old.type
      or new.final_price is distinct from old.final_price;
  end if;

  if v_touched_price then
    if new.type = 'courtesy' then
      -- Cortesia é o preço cheio zerado por decisão registrada, não um
      -- desconto grande: o valor original fica para o relatório saber quanto
      -- a casa deixou de cobrar.
      new.discount := v_base;
      new.final_price := 0;
      perform public.assert_operation_authorized(v_company_id, 'courtesy');
    else
      if new.discount is null or new.discount < 0 or new.discount > v_base then
        raise exception 'DESCONTO_MAIOR_QUE_SUBTOTAL' using errcode = '22023';
      end if;
      new.final_price := v_base - new.discount;
      if new.discount > 0 then
        perform public.assert_operation_authorized(v_company_id, 'discount');
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_attendance_item_integrity on public.attendance_item;
create trigger trg_attendance_item_integrity
  before insert or update on public.attendance_item
  for each row execute function public.enforce_attendance_item_integrity();

-- ---------------------------------------------------------------------------
-- 6. Caminho sancionado: RPCs que aceitam o código
-- ---------------------------------------------------------------------------
-- Autorizar e escrever precisam acontecer na MESMA transação, senão a marca
-- de autorização não sobrevive. Por isso a entrada de item passa a ter RPC
-- própria em vez de um insert solto na Server Action.
create or replace function public.add_attendance_service_item(
  p_attendance_id uuid,
  p_service_id uuid,
  p_professional_id uuid,
  p_discount numeric default 0,
  p_type text default 'normal',
  p_courtesy_reason text default null,
  p_authorization_code text default null
)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_item_id uuid;
begin
  select company_id into v_company_id from public.attendance where id = p_attendance_id;
  if v_company_id is null then
    raise exception 'ATENDIMENTO_NAO_ENCONTRADO' using errcode = 'P0002';
  end if;

  if p_type not in ('normal', 'courtesy') then
    raise exception 'TIPO_INVALIDO' using errcode = '22023';
  end if;
  if p_type = 'courtesy' and coalesce(btrim(p_courtesy_reason), '') = '' then
    raise exception 'MOTIVO_CORTESIA_OBRIGATORIO' using errcode = '22023';
  end if;

  if p_authorization_code is not null then
    perform public.authorize_operation(
      v_company_id, p_authorization_code,
      case when p_type = 'courtesy' then 'courtesy' else 'discount' end
    );
  end if;

  insert into public.attendance_item (
    attendance_id, kind, service_id, professional_id,
    original_price, discount, final_price, type, courtesy_reason
  )
  values (
    p_attendance_id, 'service', p_service_id, p_professional_id,
    0, coalesce(p_discount, 0), 0, p_type, nullif(btrim(p_courtesy_reason), '')
  )
  returning id into v_item_id;

  return v_item_id;
end;
$$;

create or replace function public.add_attendance_product_item(
  p_attendance_id uuid,
  p_product_id uuid,
  p_quantity numeric default 1,
  p_discount numeric default 0,
  p_type text default 'normal',
  p_courtesy_reason text default null,
  p_authorization_code text default null
)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_item_id uuid;
begin
  select company_id into v_company_id from public.attendance where id = p_attendance_id;
  if v_company_id is null then
    raise exception 'ATENDIMENTO_NAO_ENCONTRADO' using errcode = 'P0002';
  end if;

  if p_type not in ('normal', 'courtesy') then
    raise exception 'TIPO_INVALIDO' using errcode = '22023';
  end if;
  if p_type = 'courtesy' and coalesce(btrim(p_courtesy_reason), '') = '' then
    raise exception 'MOTIVO_CORTESIA_OBRIGATORIO' using errcode = '22023';
  end if;

  if p_authorization_code is not null then
    perform public.authorize_operation(
      v_company_id, p_authorization_code,
      case when p_type = 'courtesy' then 'courtesy' else 'discount' end
    );
  end if;

  insert into public.attendance_item (
    attendance_id, kind, product_id, quantity,
    original_price, discount, final_price, type, courtesy_reason
  )
  values (
    p_attendance_id, 'product', p_product_id, coalesce(p_quantity, 1),
    0, coalesce(p_discount, 0), 0, p_type, nullif(btrim(p_courtesy_reason), '')
  )
  returning id into v_item_id;

  return v_item_id;
end;
$$;

create or replace function public.update_attendance_item(
  p_item_id uuid,
  p_discount numeric default 0,
  p_type text default 'normal',
  p_courtesy_reason text default null,
  p_authorization_code text default null
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
begin
  select a.company_id into v_company_id
    from public.attendance_item ai
    join public.attendance a on a.id = ai.attendance_id
    where ai.id = p_item_id;

  if v_company_id is null then
    raise exception 'ITEM_NAO_ENCONTRADO' using errcode = 'P0002';
  end if;

  if p_type not in ('normal', 'courtesy') then
    raise exception 'TIPO_INVALIDO' using errcode = '22023';
  end if;
  if p_type = 'courtesy' and coalesce(btrim(p_courtesy_reason), '') = '' then
    raise exception 'MOTIVO_CORTESIA_OBRIGATORIO' using errcode = '22023';
  end if;

  if p_authorization_code is not null then
    perform public.authorize_operation(
      v_company_id, p_authorization_code,
      case when p_type = 'courtesy' then 'courtesy' else 'discount' end
    );
  end if;

  update public.attendance_item
    set discount = coalesce(p_discount, 0),
        type = p_type,
        courtesy_reason = nullif(btrim(p_courtesy_reason), ''),
        final_price = 0
    where id = p_item_id;
end;
$$;

revoke all on function public.add_attendance_service_item(uuid, uuid, uuid, numeric, text, text, text) from public, anon;
revoke all on function public.add_attendance_product_item(uuid, uuid, numeric, numeric, text, text, text) from public, anon;
revoke all on function public.update_attendance_item(uuid, numeric, text, text, text) from public, anon;
grant execute on function public.add_attendance_service_item(uuid, uuid, uuid, numeric, text, text, text) to authenticated;
grant execute on function public.add_attendance_product_item(uuid, uuid, numeric, numeric, text, text, text) to authenticated;
grant execute on function public.update_attendance_item(uuid, numeric, text, text, text) to authenticated;
