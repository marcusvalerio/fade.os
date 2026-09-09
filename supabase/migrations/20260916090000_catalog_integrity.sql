-- FADE OS — Rodada de correção 03: integridade do catálogo e do estoque.
--
-- O catálogo aceitava qualquer coisa e cada tela decidia sozinha o que fazer
-- com o resultado. Um serviço de -R$ 50,00 e -30 min nascia no Catálogo,
-- entrava na Agenda, chegava à vitrine, e só era recusado lá no fim, quando
-- alguém tentava fechar o atendimento. Medido na NORTE 21: 2 serviços com
-- preço negativo, 2 com preço zero, 1 com duração negativa, 2 com duração
-- zero, 1 nome de ~300 caracteres, 5 grupos de nomes duplicados ativos,
-- 12 serviços ativos sem nenhum profissional e 12 profissionais ativos sem
-- nenhum serviço — todos publicados na vitrine.
--
-- Duas correções distintas, de propósito:
--
--   1. VALIDAÇÃO — impede que dado inválido NASÇA. Fica em trigger, no ponto
--      onde a linha é gravada, valendo para Server Action, PostgREST direto e
--      código futuro.
--
--   2. ELEGIBILIDADE — impede que dado inválido ENTRE NA OPERAÇÃO. Fica em
--      view, e todas as superfícies (Agenda, Atendimento, motor, vitrine)
--      passam a ler da mesma definição.
--
-- Por que trigger e não CHECK: os registros inválidos do laboratório são
-- evidência de QA e não podem ser apagados nem "consertados" para a migration
-- passar. Um CHECK (mesmo NOT VALID) bloquearia qualquer UPDATE numa linha
-- legada — inclusive desativá-la, que é justamente o que o operador precisa
-- poder fazer. O trigger valida na inserção e, na atualização, só o que
-- mudou: nunca deixa piorar, e não prende o legado.
--
-- Sobre preço zero: cortesia já tem semântica própria no FADE.OS
-- (attendance_item.type = 'courtesy', com autorização e motivo). Preço zero no
-- catálogo seria um segundo mecanismo, mais fraco, para a mesma coisa — e que
-- produz um atendimento que a interface não consegue fechar (o botão exige
-- subtotal > 0) e uma venda que o banco recusa (VENDA_SEM_PAGAMENTO). É
-- exatamente a contradição que esta rodada existe para eliminar, então preço
-- de catálogo é > 0, para serviço e para produto.

-- ---------------------------------------------------------------------------
-- 1. Os limites do domínio, num lugar só
-- ---------------------------------------------------------------------------
-- Duração máxima: o motor gera slots dentro da janela de UM dia de
-- funcionamento, então um serviço que não cabe num turno nunca produz
-- horário. 480 min (8h) é folgado — o serviço mais longo da NORTE 21 tem
-- 70 min — e existe para barrar o erro de digitação, não para limitar o
-- produto. Comissão: 0 a 100; acima de 100 a casa pagaria mais do que
-- recebeu. Nome: 80 para itens de catálogo, 120 para pessoas (o mesmo teto
-- que o agendamento público já usa para nome de cliente).
create or replace function public.catalog_limits()
returns table (
  name_min int, name_max int, person_name_max int,
  duration_min int, duration_max int,
  commission_min numeric, commission_max numeric
)
language sql immutable
set search_path = public, pg_temp
as $$ select 2, 80, 120, 1, 480, 0::numeric, 100::numeric $$;

grant execute on function public.catalog_limits() to authenticated, anon;

-- Espaço em volta e espaço repetido no meio transformavam "Pomada",
-- " Pomada " e "Pomada  " em três coisas diferentes. Normaliza numa função
-- só, usada por todos os triggers abaixo.
create or replace function public.normalize_name(p_name text)
returns text
language sql immutable
set search_path = public, pg_temp
as $$ select nullif(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), '') $$;

grant execute on function public.normalize_name(text) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 2. Serviço: normaliza e valida
-- ---------------------------------------------------------------------------
create or replace function public.assert_service_valid()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  l record;
  v_novo boolean := (tg_op = 'INSERT');
begin
  select * into l from public.catalog_limits();

  new.name := public.normalize_name(new.name);
  new.category := public.normalize_name(new.category);
  new.description := nullif(btrim(coalesce(new.description, '')), '');

  -- Sensível a mudança, como preço e duração: a baixa de estoque de uma venda
  -- é um update em product, e um nome legado fora do limite tornaria o produto
  -- invendável. Nunca deixa piorar, e não prende o legado.
  if v_novo or new.name is distinct from old.name then
    if new.name is null or char_length(new.name) < l.name_min then
      raise exception 'NOME_INVALIDO' using errcode = '22023';
    end if;
    if char_length(new.name) > l.name_max then
      raise exception 'NOME_LONGO_DEMAIS' using errcode = '22023';
    end if;
  end if;

  -- Na atualização, só o que mudou. Assim uma linha legada inválida ainda
  -- pode ser desativada ou renomeada sem que o valor antigo trave a operação.
  if v_novo or new.default_price is distinct from old.default_price then
    if new.default_price is null or new.default_price <= 0 then
      raise exception 'PRECO_INVALIDO' using errcode = '22023';
    end if;
  end if;

  if v_novo or new.planned_duration_minutes is distinct from old.planned_duration_minutes then
    if new.planned_duration_minutes is null
       or new.planned_duration_minutes < l.duration_min
       or new.planned_duration_minutes > l.duration_max then
      raise exception 'DURACAO_INVALIDA' using errcode = '22023';
    end if;
  end if;

  if (v_novo or new.default_commission_percent is distinct from old.default_commission_percent)
     and new.default_commission_percent is not null
     and (new.default_commission_percent < l.commission_min
          or new.default_commission_percent > l.commission_max) then
    raise exception 'COMISSAO_INVALIDA' using errcode = '22023';
  end if;

  -- Duplicidade só é checada quando o nome muda ou o serviço (re)entra em
  -- atividade: os duplicados que já existem continuam onde estão.
  if new.status = 'active'
     and (v_novo or new.name is distinct from old.name or old.status is distinct from 'active')
     and exists (
       select 1 from public.service s
       where s.company_id = new.company_id
         and s.id is distinct from new.id
         and s.status = 'active'
         and lower(s.name) = lower(new.name)
     ) then
    raise exception 'NOME_DUPLICADO' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists service_is_valid on public.service;
create trigger service_is_valid
  before insert or update on public.service
  for each row execute function public.assert_service_valid();

-- ---------------------------------------------------------------------------
-- 3. Produto e material
-- ---------------------------------------------------------------------------
-- Produto tinha validação melhor que serviço (preço e custo não-negativos já
-- eram recusados), então aqui só se acrescenta o que faltava: nome
-- normalizado e limitado, duplicidade, e preço de venda > 0 pela mesma razão
-- do serviço — um produto de R$ 0,00 monta um carrinho que o PDV não fecha.
create or replace function public.assert_product_valid()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  l record;
  v_novo boolean := (tg_op = 'INSERT');
begin
  select * into l from public.catalog_limits();

  new.name := public.normalize_name(new.name);
  new.category := public.normalize_name(new.category);

  -- Sensível a mudança, como preço e duração: a baixa de estoque de uma venda
  -- é um update em product, e um nome legado fora do limite tornaria o produto
  -- invendável. Nunca deixa piorar, e não prende o legado.
  if v_novo or new.name is distinct from old.name then
    if new.name is null or char_length(new.name) < l.name_min then
      raise exception 'NOME_INVALIDO' using errcode = '22023';
    end if;
    if char_length(new.name) > l.name_max then
      raise exception 'NOME_LONGO_DEMAIS' using errcode = '22023';
    end if;
  end if;

  if (v_novo or new.sale_price is distinct from old.sale_price)
     and (new.sale_price is null or new.sale_price <= 0) then
    raise exception 'PRECO_INVALIDO' using errcode = '22023';
  end if;

  if (v_novo or new.cost_price is distinct from old.cost_price)
     and (new.cost_price is null or new.cost_price < 0) then
    raise exception 'CUSTO_INVALIDO' using errcode = '22023';
  end if;

  if new.active
     and (v_novo or new.name is distinct from old.name or old.active is distinct from true)
     and exists (
       select 1 from public.product x
       where x.company_id = new.company_id and x.id is distinct from new.id
         and x.active and lower(x.name) = lower(new.name)
     ) then
    raise exception 'NOME_DUPLICADO' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists product_is_valid on public.product;
create trigger product_is_valid
  before insert or update on public.product
  for each row execute function public.assert_product_valid();

-- Material não tem preço de venda de propósito: é consumo interno, não entra
-- no PDV e não gera comissão. Isso continua exatamente como está.
create or replace function public.assert_consumable_valid()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  l record;
  v_novo boolean := (tg_op = 'INSERT');
begin
  select * into l from public.catalog_limits();

  new.name := public.normalize_name(new.name);
  new.category := public.normalize_name(new.category);

  -- Sensível a mudança, como preço e duração: a baixa de estoque de uma venda
  -- é um update em product, e um nome legado fora do limite tornaria o produto
  -- invendável. Nunca deixa piorar, e não prende o legado.
  if v_novo or new.name is distinct from old.name then
    if new.name is null or char_length(new.name) < l.name_min then
      raise exception 'NOME_INVALIDO' using errcode = '22023';
    end if;
    if char_length(new.name) > l.name_max then
      raise exception 'NOME_LONGO_DEMAIS' using errcode = '22023';
    end if;
  end if;

  if (v_novo or new.cost_price is distinct from old.cost_price)
     and (new.cost_price is null or new.cost_price < 0) then
    raise exception 'CUSTO_INVALIDO' using errcode = '22023';
  end if;

  if new.active
     and (v_novo or new.name is distinct from old.name or old.active is distinct from true)
     and exists (
       select 1 from public.consumable x
       where x.company_id = new.company_id and x.id is distinct from new.id
         and x.active and lower(x.name) = lower(new.name)
     ) then
    raise exception 'NOME_DUPLICADO' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists consumable_is_valid on public.consumable;
create trigger consumable_is_valid
  before insert or update on public.consumable
  for each row execute function public.assert_consumable_valid();

-- ---------------------------------------------------------------------------
-- 4. Profissional
-- ---------------------------------------------------------------------------
-- Sem regra de nome único: dois barbeiros podem se chamar Rafael, e o
-- sistema já os distingue por e-mail e pelo identificador de acesso. O que
-- estava faltando era o teto do nome e a faixa da comissão.
create or replace function public.assert_professional_valid()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  l record;
  v_novo boolean := (tg_op = 'INSERT');
begin
  select * into l from public.catalog_limits();

  new.name := public.normalize_name(new.name);
  new.role_title := public.normalize_name(new.role_title);

  if v_novo or new.name is distinct from old.name then
    if new.name is null or char_length(new.name) < l.name_min then
      raise exception 'NOME_INVALIDO' using errcode = '22023';
    end if;
    if char_length(new.name) > l.person_name_max then
      raise exception 'NOME_LONGO_DEMAIS' using errcode = '22023';
    end if;
  end if;

  if (v_novo or new.default_commission_percent is distinct from old.default_commission_percent)
     and new.default_commission_percent is not null
     and (new.default_commission_percent < l.commission_min
          or new.default_commission_percent > l.commission_max) then
    raise exception 'COMISSAO_INVALIDA' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists professional_is_valid on public.professional;
create trigger professional_is_valid
  before insert or update on public.professional
  for each row execute function public.assert_professional_valid();

-- ---------------------------------------------------------------------------
-- 5. Elegibilidade — a fronteira, num lugar só
-- ---------------------------------------------------------------------------
-- ATIVO ≠ OPERACIONAL ≠ PUBLICÁVEL. Eram a mesma coisa até agora, e é por
-- isso que a vitrine anunciava serviço de -R$ 50,00 e 12 profissionais que
-- ninguém consegue marcar.
--
-- security_invoker: a view não é uma porta lateral, o RLS de quem consulta
-- continua valendo.

-- Operacional: dá para executar e cobrar. Exclui o legado inválido sem
-- apagá-lo — ele continua no catálogo, visível para quem administra, fora
-- de qualquer operação nova.
create or replace view public.service_operational
with (security_invoker = true) as
  select s.*
  from public.service s, public.catalog_limits() l
  where s.status = 'active'
    and s.default_price > 0
    and s.planned_duration_minutes between l.duration_min and l.duration_max;

-- Publicável: operacional + marcado como público + alguém ativo que execute.
-- Anunciar serviço que ninguém faz é promessa falsa.
create or replace view public.service_publishable
with (security_invoker = true) as
  select s.*
  from public.service_operational s
  where s.is_public
    and exists (
      select 1
      from public.professional_service ps
      join public.professional p on p.id = ps.professional_id
      where ps.service_id = s.id and p.active
    );

-- Profissional publicável: ativo E com ao menos um serviço publicável.
-- Quem só atende serviços internos não vira vitrine por causa deles.
create or replace view public.professional_publishable
with (security_invoker = true) as
  select distinct p.*
  from public.professional p
  join public.professional_service ps on ps.professional_id = p.id
  join public.service_publishable s on s.id = ps.service_id
  where p.active;

grant select on public.service_operational, public.service_publishable,
                public.professional_publishable to authenticated;

-- ---------------------------------------------------------------------------
-- 6. A vitrine passa a ler da fronteira
-- ---------------------------------------------------------------------------
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
  from public.service_publishable s
  join public.company c on c.id = s.company_id
  where c.slug = public.slugify(p_slug)
  order by s.category nulls last, s.name;
$$;

revoke all on function public.get_public_services(text) from public;
grant execute on function public.get_public_services(text) to anon, authenticated;

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
  join public.service_publishable s on s.id = ps.service_id
  join public.company c on c.id = s.company_id
  where c.slug = public.slugify(p_slug)
    and s.id = p_service_id
    and p.active
  order by p.name;
$$;

revoke all on function public.get_public_professionals(text, uuid) from public;
grant execute on function public.get_public_professionals(text, uuid) to anon, authenticated;

-- A vitrine anunciava todo profissional ativo — 16 na NORTE 21, dos quais
-- 4 eram realmente agendáveis.
create or replace function public.get_public_team(p_slug text)
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
  from public.professional_publishable p
  join public.company c on c.id = p.company_id
  where c.slug = public.slugify(p_slug)
  order by p.name;
$$;

revoke all on function public.get_public_team(text) from public;
grant execute on function public.get_public_team(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. O motor de disponibilidade usa a mesma definição
-- ---------------------------------------------------------------------------
-- Uma linha: a duração passa a vir de service_operational. Serviço inativo ou
-- inválido deixa de gerar slot na origem, em vez de ser recusado só no
-- momento de agendar. O resto do motor — jornada, funcionamento, intervalos,
-- bloqueios, ausências, conflitos — fica intacto.
create or replace function public.get_available_slots(
  p_company_id uuid,
  p_unit_id uuid,
  p_service_id uuid,
  p_date date,
  p_professional_id uuid default null
)
returns table (
  professional_id uuid,
  professional_name text,
  slot_start timestamptz,
  slot_end timestamptz
)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_duration_minutes int;
  v_slot_step_minutes constant int := 15;
  v_business_timezone constant text := 'America/Sao_Paulo';
  v_weekday int;
  v_unit_has_hours boolean;
begin
  -- A ÚNICA mudança nesta função: a duração passa a vir de
  -- service_operational em vez de service. Serviço inválido ou inativo deixa
  -- de gerar slot na origem. Todo o resto — jornada, funcionamento,
  -- intervalos, bloqueios, ausências, conflitos e ordenação — é exatamente o
  -- motor já validado, copiado sem alteração.
  select planned_duration_minutes into v_duration_minutes
  from public.service_operational
  where id = p_service_id and company_id = p_company_id;

  if v_duration_minutes is null then
    return;
  end if;

  if not exists (
    select 1 from public.unit where id = p_unit_id and company_id = p_company_id
  ) then
    return;
  end if;

  v_weekday := extract(dow from p_date)::int;

  select true into v_unit_has_hours
  from public.unit_business_hours
  where unit_id = p_unit_id and weekday = v_weekday and active
  limit 1;

  if v_unit_has_hours is not true then
    return;
  end if;

  return query
  with eligible_professionals as (
    select p.id, p.name
    from public.professional p
    join public.professional_service ps
      on ps.professional_id = p.id and ps.service_id = p_service_id
    where p.company_id = p_company_id
      and p.active
      and (p_professional_id is null or p.id = p_professional_id)
      and (p.unit_id is null or p.unit_id = p_unit_id)
  ),
  professional_windows as (
    select
      ep.id as professional_id,
      ep.name as professional_name,
      psch.id as schedule_id,
      greatest(psch.start_time, ubh.start_time) as window_start,
      least(psch.end_time, ubh.end_time) as window_end
    from eligible_professionals ep
    join public.professional_schedule psch
      on psch.professional_id = ep.id and psch.weekday = v_weekday and psch.active
    join public.unit_business_hours ubh
      on ubh.unit_id = p_unit_id and ubh.weekday = v_weekday and ubh.active
    where greatest(psch.start_time, ubh.start_time) < least(psch.end_time, ubh.end_time)
  ),
  candidate_slots as (
    select
      pw.professional_id,
      pw.professional_name,
      pw.schedule_id,
      (((p_date + pw.window_start) at time zone v_business_timezone)
        + (n * v_slot_step_minutes) * interval '1 minute') as slot_start,
      (((p_date + pw.window_start) at time zone v_business_timezone)
        + (n * v_slot_step_minutes) * interval '1 minute'
        + v_duration_minutes * interval '1 minute') as slot_end,
      ((p_date + pw.window_end) at time zone v_business_timezone) as window_end_ts
    from professional_windows pw
    cross join lateral generate_series(
      0,
      greatest(0, (extract(epoch from (pw.window_end - pw.window_start))::int / 60) / v_slot_step_minutes)
    ) as n
  )
  select cs.professional_id, cs.professional_name, cs.slot_start, cs.slot_end
  from candidate_slots cs
  where cs.slot_end <= cs.window_end_ts
    and not exists (
      select 1 from public.professional_schedule_break b
      where b.schedule_id = cs.schedule_id
        and tstzrange(cs.slot_start, cs.slot_end)
          && tstzrange(
            (p_date + b.start_time) at time zone v_business_timezone,
            (p_date + b.end_time) at time zone v_business_timezone
          )
    )
    and not exists (
      select 1 from public.professional_block pb
      where pb.professional_id = cs.professional_id
        and pb.status = 'active'
        and tstzrange(cs.slot_start, cs.slot_end) && tstzrange(pb.starts_at, pb.ends_at)
    )
    and not exists (
      select 1 from public.professional_absence pa
      where pa.professional_id = cs.professional_id
        and tstzrange(cs.slot_start, cs.slot_end) && tstzrange(pa.starts_at, pa.ends_at)
    )
    and not exists (
      select 1 from public.appointment_service aps
      where aps.professional_id = cs.professional_id
        and aps.is_active
        and tstzrange(cs.slot_start, cs.slot_end) && tstzrange(aps.starts_at, aps.ends_at)
    )
  order by cs.professional_id, cs.slot_start;
end;
$$;

revoke all on function public.get_available_slots(uuid, uuid, uuid, date, uuid) from public;
grant execute on function public.get_available_slots(uuid, uuid, uuid, date, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Inventário é CONTAGEM, não entrada
-- ---------------------------------------------------------------------------
-- Saldo 8, o operador conta 8 e digita 8 — e o saldo virava 16, porque
-- 'inventory' caía no mesmo `else p_quantity` de 'adjustment' e era somado
-- como delta. Agora inventário diz "o saldo físico agora é X" e o sistema
-- calcula o delta necessário.
--
-- A leitura do saldo acontece sob a mesma trava de linha das vendas
-- (apply_stock_delta faz `for update`), então uma venda concorrente ou entra
-- antes e é contada, ou espera e enxerga o saldo já corrigido. Não existe
-- janela para o inventário sobrescrever uma baixa que aconteceu no meio.
alter table public.stock_movement
  add column if not exists counted_quantity numeric;

comment on column public.stock_movement.counted_quantity is
  'Saldo físico informado numa contagem de inventário. Nulo nos demais tipos de movimento — neles quantity já é o delta e basta.';

create or replace function public.adjust_stock(
  p_company_id uuid,
  p_unit_id uuid,
  p_item_type text,
  p_item_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_unit_cost numeric default null,
  p_reason text default null
)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_movement_id uuid;
  v_signed_quantity numeric;
  v_counted numeric;
  v_current numeric;
begin
  if p_item_type not in ('product', 'consumable') then
    raise exception 'TIPO_INVALIDO' using errcode = '22023';
  end if;
  if p_movement_type not in ('entry', 'consumption', 'adjustment', 'loss', 'inventory') then
    raise exception 'MOVIMENTO_INVALIDO' using errcode = '22023';
  end if;
  if p_quantity is null then
    raise exception 'QUANTIDADE_INVALIDA' using errcode = '22023';
  end if;

  if p_movement_type = 'inventory' then
    -- Contagem: o número informado É o saldo, não um acréscimo. Zero é uma
    -- contagem legítima ("não sobrou nenhum"), e contar o mesmo que já havia
    -- é um delta de zero — os dois casos precisam passar.
    if p_quantity < 0 then
      raise exception 'QUANTIDADE_INVALIDA' using errcode = '22023';
    end if;

    v_counted := p_quantity;

    if p_item_type = 'product' then
      select current_stock into v_current from public.product
        where id = p_item_id and company_id = p_company_id and unit_id = p_unit_id
        for update;
    else
      select current_stock into v_current from public.consumable
        where id = p_item_id and company_id = p_company_id and unit_id = p_unit_id
        for update;
    end if;

    if v_current is null then
      raise exception 'ITEM_ESTOQUE_INVALIDO' using errcode = '22023';
    end if;

    v_signed_quantity := v_counted - v_current;
  else
    if p_quantity = 0 then
      raise exception 'QUANTIDADE_INVALIDA' using errcode = '22023';
    end if;
    v_signed_quantity := case
      when p_movement_type = 'entry' then abs(p_quantity)
      when p_movement_type in ('consumption', 'loss') then -abs(p_quantity)
      else p_quantity
    end;
  end if;

  if v_signed_quantity <> 0 then
    perform public.apply_stock_delta(p_company_id, p_unit_id, p_item_type, p_item_id, v_signed_quantity);
  end if;

  -- Uma contagem que confirma o saldo é um fato de auditoria — fica
  -- registrada mesmo com delta zero.
  insert into public.stock_movement (
    company_id, unit_id, item_type, product_id, consumable_id,
    movement_type, quantity, counted_quantity, unit_cost, reason, created_by
  )
  values (
    p_company_id, p_unit_id, p_item_type,
    case when p_item_type = 'product' then p_item_id end,
    case when p_item_type = 'consumable' then p_item_id end,
    p_movement_type, v_signed_quantity, v_counted, p_unit_cost, p_reason, auth.uid()
  )
  returning id into v_movement_id;

  if p_movement_type in ('adjustment', 'loss', 'inventory') then
    perform public.write_audit_log(
      p_company_id, 'adjust_stock', p_item_type, p_item_id,
      jsonb_build_object('saldo_anterior', v_current),
      jsonb_build_object('movement_type', p_movement_type, 'delta', v_signed_quantity,
                         'contagem', v_counted),
      p_reason
    );
  end if;

  return v_movement_id;
end;
$$;

revoke all on function public.adjust_stock(uuid, uuid, text, uuid, text, numeric, numeric, text) from public;
grant execute on function public.adjust_stock(uuid, uuid, text, uuid, text, numeric, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Uma contagem que confirma o saldo é um fato, não um não-evento
-- ---------------------------------------------------------------------------
-- O CHECK antigo (quantity <> 0) fazia sentido enquanto todo movimento era
-- delta. Com inventário virando contagem, ele passava a barrar exatamente o
-- registro mais importante do inventário: "conferi, e bate". Descoberto pelo
-- teste de contagem igual ao saldo, não por leitura de código.
--
-- Para todos os outros tipos a regra continua: entrada, saída, venda, perda e
-- ajuste de zero unidades seguem sem significado.
alter table public.stock_movement drop constraint if exists stock_movement_quantity_check;

alter table public.stock_movement
  add constraint stock_movement_quantity_check
  check (movement_type = 'inventory' or quantity <> 0);
