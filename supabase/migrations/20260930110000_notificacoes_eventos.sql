-- Notificações do CORTEX — eventos.
--
-- Cada evento que merece aviso vira uma chamada a notificar() (via os
-- atalhos notificar_gestores / notificar_profissional / notificar_cliente),
-- disparada por trigger no próprio banco. Assim nenhum caminho (tela, RPC,
-- importação, Admin) esquece de avisar, e nada avisa duas vezes: cada evento
-- tem uma chave (chave_unica) e a mesma pessoa recebe um aviso por evento,
-- mesmo que seja dona e profissional ao mesmo tempo.
--
-- Regras que valem para todos:
--   * quem causou o evento não é avisado do que acabou de fazer (auth.uid()),
--     exceto estado de estoque, que vale para a gerência mesmo quando foi
--     ela quem vendeu a última unidade;
--   * uma falha ao notificar NUNCA desfaz a operação de negócio: cada trigger
--     engole o erro e deixa um WARNING no log do Postgres;
--   * nada de aviso para mudança pequena: só o que pede atenção ou ação.

-- ---------------------------------------------------------------------------
-- 1. Tipos que faltavam no catálogo (pedidos na especificação)
-- ---------------------------------------------------------------------------
insert into public.notificacao_tipo (chave, categoria, preferencia, prioridade, obrigatoria, padrao_ligada, publicos, push, comunicavel, descricao) values
  ('agenda.avaliar',        'agenda',     'agenda.avaliacoes',     'informational', false, true, '{cliente}',              true,  false, 'Pedido de avaliação depois do atendimento'),
  ('clientes.novo',         'clientes',   'clientes.novos',        'informational', false, true, '{gestor}',               false, false, 'Cliente criou conta na página da barbearia'),
  ('financeiro.caixa_fechado', 'financeiro', 'financeiro.fechamentos', 'informational', false, true, '{gestor}',          false, false, 'Caixa fechado por outra pessoa'),
  ('equipe.alteracao',      'equipe',     'equipe.alteracoes',     'informational', false, true, '{gestor}',               false, false, 'Profissional entrou ou saiu da equipe')
on conflict (chave) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Auxiliares
-- ---------------------------------------------------------------------------
-- Horário no fuso da barbearia, do jeito que a interface escreve.
create or replace function public.notificacao_quando(p_ts timestamptz)
returns text
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select to_char(p_ts at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI');
$function$;

create or replace function public.notificacao_dia(p_ts timestamptz)
returns text
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select to_char(p_ts at time zone 'America/Sao_Paulo', 'YYYY-MM-DD');
$function$;

-- Valor em reais no formato brasileiro (independe do locale do servidor).
create or replace function public.notificacao_reais(p_valor numeric)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  select 'R$ ' || translate(to_char(coalesce(p_valor, 0), 'FM999,999,990.00'), ',.', '.,');
$function$;

-- Resumo de um agendamento para o texto do aviso.
create or replace function public.notificacao_resumo_agendamento(p_appointment uuid, out cliente text, out servicos text, out inicio timestamptz, out empresa text, out slug text, out token uuid)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select split_part(btrim(cl.name), ' ', 1),
         (select string_agg(s.name, ' + ' order by aps.starts_at) from public.appointment_service aps join public.service s on s.id = aps.service_id where aps.appointment_id = a.id),
         (select min(aps.starts_at) from public.appointment_service aps where aps.appointment_id = a.id),
         coalesce(nullif(btrim(c.trade_name), ''), c.name), c.slug, a.client_access_token
    from public.appointment a
    join public.client cl on cl.id = a.client_id
    join public.company c on c.id = a.company_id
   where a.id = p_appointment;
$function$;

-- A pessoa faz parte da equipe da barbearia (dono, gerência ou profissional)?
create or replace function public.notificacao_eh_equipe(p_user uuid, p_company uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select p_user is not null and exists (select 1 from public.user_company_role where user_id = p_user and company_id = p_company);
$function$;

revoke all on function public.notificacao_resumo_agendamento(uuid) from public, anon, authenticated;
revoke all on function public.notificacao_eh_equipe(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Agenda
-- ---------------------------------------------------------------------------
-- Novo agendamento. Deferida: o agendamento e suas linhas (serviço,
-- profissional, horário) são gravados na mesma transação, e o aviso só é
-- montado no commit, com tudo lá.
create or replace function public.notificar_agendamento_novo()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_ator uuid := auth.uid();
  r record;
  v_prof uuid;
  v_corpo text;
  v_chave text := 'agenda.novo:' || new.id;
  v_dados jsonb;
  v_pela_equipe boolean;
begin
  begin
    select * into r from public.notificacao_resumo_agendamento(new.id);
    if r.inicio is null or r.inicio < now() then
      return null; -- lançamento retroativo não é novidade
    end if;
    v_pela_equipe := public.notificacao_eh_equipe(v_ator, new.company_id);
    v_corpo := case when v_pela_equipe
      then format('%s · %s · %s.', r.cliente, r.servicos, public.notificacao_quando(r.inicio))
      else format('%s marcou %s para %s.', r.cliente, r.servicos, public.notificacao_quando(r.inicio)) end;
    v_dados := jsonb_build_object('agendamento', new.id);
    for v_prof in select distinct aps.professional_id from public.appointment_service aps where aps.appointment_id = new.id and aps.is_active loop
      perform public.notificar_profissional(v_prof, 'agenda.novo', 'Novo agendamento', v_corpo,
        '/agenda?date=' || public.notificacao_dia(r.inicio) || '&prof=eu', v_dados, v_chave, v_ator);
    end loop;
    -- Marcado pela própria equipe: a gerência já sabe. Pela página/área do
    -- cliente: a gerência também quer saber.
    if not v_pela_equipe then
      perform public.notificar_gestores(new.company_id, 'agenda.novo', 'Novo agendamento online', v_corpo,
        '/agenda?date=' || public.notificacao_dia(r.inicio), v_dados, v_chave, v_ator);
    end if;
  exception when others then
    raise warning 'notificacao agenda.novo falhou: %', sqlerrm;
  end;
  return null;
end;
$function$;

create constraint trigger notificar_agendamento_novo
  after insert on public.appointment
  deferrable initially deferred
  for each row execute function public.notificar_agendamento_novo();

-- Mudança de status.
create or replace function public.notificar_agendamento_status()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_ator uuid := auth.uid();
  r record;
  v_prof uuid;
  v_dados jsonb := jsonb_build_object('agendamento', new.id);
  v_url_equipe text;
  v_url_cliente text;
  v_chave text;
begin
  if new.status is not distinct from old.status then
    return null;
  end if;
  begin
    select * into r from public.notificacao_resumo_agendamento(new.id);
    v_url_equipe := '/agenda?date=' || public.notificacao_dia(coalesce(r.inicio, now()));
    v_url_cliente := '/' || r.slug || '/minha-conta';
    v_chave := 'agenda.' || new.status || ':' || new.id;

    if new.status = 'confirmed' and old.status = 'scheduled' then
      perform public.notificar_cliente(new.client_id, 'agenda.confirmado', 'Horário confirmado',
        format('%s confirmou seu horário de %s.', r.empresa, public.notificacao_quando(r.inicio)), v_url_cliente, v_dados, v_chave, v_ator);

    elsif new.status = 'arrived' then
      for v_prof in select distinct aps.professional_id from public.appointment_service aps where aps.appointment_id = new.id and aps.is_active loop
        perform public.notificar_profissional(v_prof, 'agenda.chegou', 'Cliente chegou',
          format('%s chegou para %s.', r.cliente, r.servicos), v_url_equipe || '&prof=eu', v_dados, v_chave, v_ator);
      end loop;

    elsif new.status = 'cancelled_by_client' then
      for v_prof in select distinct aps.professional_id from public.appointment_service aps where aps.appointment_id = new.id loop
        perform public.notificar_profissional(v_prof, 'agenda.cancelado', 'Agendamento cancelado',
          format('%s cancelou %s de %s.', r.cliente, r.servicos, public.notificacao_quando(r.inicio)), v_url_equipe || '&prof=eu', v_dados, v_chave, v_ator);
      end loop;
      perform public.notificar_gestores(new.company_id, 'agenda.cancelado', 'Agendamento cancelado',
        format('%s cancelou %s de %s. O horário ficou livre.', r.cliente, r.servicos, public.notificacao_quando(r.inicio)), v_url_equipe, v_dados, v_chave, v_ator);

    elsif new.status = 'cancelled_by_company' then
      perform public.notificar_cliente(new.client_id, 'agenda.cancelado', 'Seu horário foi cancelado',
        format('%s cancelou seu horário de %s. Você pode marcar outro pela página da barbearia.', r.empresa, public.notificacao_quando(r.inicio)),
        '/' || r.slug, v_dados, v_chave, v_ator);
      for v_prof in select distinct aps.professional_id from public.appointment_service aps where aps.appointment_id = new.id loop
        perform public.notificar_profissional(v_prof, 'agenda.cancelado', 'Agendamento cancelado',
          format('O horário de %s (%s) foi cancelado.', r.cliente, public.notificacao_quando(r.inicio)), v_url_equipe || '&prof=eu', v_dados, v_chave, v_ator);
      end loop;

    elsif new.status = 'no_show' then
      perform public.notificar_gestores(new.company_id, 'agenda.nao_compareceu', 'Cliente não compareceu',
        format('%s não veio para %s de %s.', r.cliente, r.servicos, public.notificacao_quando(r.inicio)), v_url_equipe, v_dados, v_chave, v_ator);
    end if;
  exception when others then
    raise warning 'notificacao status do agendamento falhou: %', sqlerrm;
  end;
  return null;
end;
$function$;

create trigger notificar_agendamento_status
  after update of status on public.appointment
  for each row execute function public.notificar_agendamento_status();

-- Reagendamento: as RPCs de reagendar registram no audit_log com as linhas
-- de antes. Deferida para ler as linhas já na posição nova.
create or replace function public.notificar_reagendamento()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_ator uuid := coalesce(new.user_id, auth.uid());
  r record;
  v_prof uuid;
  v_chave text := 'agenda.reagendado:' || new.id;
  v_dados jsonb := jsonb_build_object('agendamento', new.entity_id);
  v_client uuid;
  v_quando text;
  v_url text;
begin
  if new.action not in ('reschedule_appointment', 'client_reschedule_appointment') or new.entity_id is null then
    return null;
  end if;
  begin
    select * into r from public.notificacao_resumo_agendamento(new.entity_id);
    select a.client_id into v_client from public.appointment a where a.id = new.entity_id;
    v_quando := public.notificacao_quando(r.inicio);
    v_url := '/agenda?date=' || public.notificacao_dia(r.inicio);

    -- quem atende agora
    for v_prof in select distinct aps.professional_id from public.appointment_service aps where aps.appointment_id = new.entity_id and aps.is_active loop
      perform public.notificar_profissional(v_prof, 'agenda.reagendado', 'Horário mudou',
        format('%s: %s agora é %s.', r.cliente, r.servicos, v_quando), v_url || '&prof=eu', v_dados, v_chave, v_ator);
    end loop;
    -- quem deixou de atender (trocou de profissional)
    for v_prof in
      select distinct (l->>'professional_id')::uuid from jsonb_array_elements(coalesce(new.before->'lines', '[]'::jsonb)) l
       where (l->>'professional_id') is not null
         and not exists (select 1 from public.appointment_service aps where aps.appointment_id = new.entity_id and aps.is_active and aps.professional_id = (l->>'professional_id')::uuid)
    loop
      perform public.notificar_profissional(v_prof, 'agenda.reagendado', 'Horário saiu da sua agenda',
        format('%s (%s) passou para outro profissional.', r.cliente, r.servicos), v_url || '&prof=eu', v_dados, v_chave, v_ator);
    end loop;

    if new.action = 'client_reschedule_appointment' then
      perform public.notificar_gestores(new.company_id, 'agenda.reagendado', 'Cliente mudou o horário',
        format('%s mudou %s para %s.', r.cliente, r.servicos, v_quando), v_url, v_dados, v_chave, v_ator);
    else
      perform public.notificar_cliente(v_client, 'agenda.reagendado', 'Seu horário mudou',
        format('%s mudou seu horário para %s.', r.empresa, v_quando), '/' || r.slug || '/minha-conta', v_dados, v_chave, v_ator);
    end if;
  exception when others then
    raise warning 'notificacao reagendamento falhou: %', sqlerrm;
  end;
  return null;
end;
$function$;

create constraint trigger notificar_reagendamento
  after insert on public.audit_log
  deferrable initially deferred
  for each row
  when (new.action in ('reschedule_appointment', 'client_reschedule_appointment'))
  execute function public.notificar_reagendamento();

-- Atendimento concluído a partir de um agendamento: pede avaliação ao
-- cliente que tem conta (link do próprio agendamento, que ele já recebeu).
create or replace function public.notificar_pedido_de_avaliacao()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  r record;
begin
  if new.status <> 'completed' or old.status = 'completed' or new.origin_appointment_id is null then
    return null;
  end if;
  begin
    if exists (select 1 from public.attendance_rating ar where ar.attendance_id = new.id) then
      return null;
    end if;
    select * into r from public.notificacao_resumo_agendamento(new.origin_appointment_id);
    perform public.notificar_cliente(new.client_id, 'agenda.avaliar', 'Como foi seu atendimento?',
      format('Conte para a %s como foi. Leva 10 segundos.', r.empresa),
      '/' || r.slug || '/agendamentos/' || r.token, jsonb_build_object('atendimento', new.id), 'agenda.avaliar:' || new.id, auth.uid());
  exception when others then
    raise warning 'notificacao pedido de avaliacao falhou: %', sqlerrm;
  end;
  return null;
end;
$function$;

create trigger notificar_pedido_de_avaliacao
  after update of status on public.attendance
  for each row execute function public.notificar_pedido_de_avaliacao();

-- Lembrete ~2 h antes, para o cliente com conta. Roda pelo pg_cron a cada
-- 10 min; a janela de 20 min cobre folga de agenda e a chave evita repetir.
create or replace function public.notificar_lembretes_de_agenda()
returns int
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  a record;
  v_n int := 0;
begin
  for a in
    select ap.id, ap.client_id, min(aps.starts_at) as inicio
      from public.appointment ap
      join public.appointment_service aps on aps.appointment_id = ap.id and aps.is_active
      join public.company c on c.id = ap.company_id and c.status = 'active'
     where ap.status in ('scheduled', 'confirmed')
       and exists (select 1 from public.client_identity ci where ci.client_id = ap.client_id)
     group by ap.id, ap.client_id
    having min(aps.starts_at) between now() + interval '110 minutes' and now() + interval '130 minutes'
  loop
    begin
      v_n := v_n + public.notificar_cliente(a.client_id, 'agenda.lembrete', 'Seu horário é daqui a pouco',
        (select format('%s às %s, na %s.', r.servicos, to_char(a.inicio at time zone 'America/Sao_Paulo', 'HH24:MI'), r.empresa) from public.notificacao_resumo_agendamento(a.id) r),
        (select '/' || r.slug || '/minha-conta' from public.notificacao_resumo_agendamento(a.id) r),
        jsonb_build_object('agendamento', a.id), 'agenda.lembrete:' || a.id);
    exception when others then
      raise warning 'lembrete % falhou: %', a.id, sqlerrm;
    end;
  end loop;
  return v_n;
end;
$function$;

revoke all on function public.notificar_lembretes_de_agenda() from public, anon, authenticated;
grant execute on function public.notificar_lembretes_de_agenda() to service_role;

-- ---------------------------------------------------------------------------
-- 4. Clientes
-- ---------------------------------------------------------------------------
create or replace function public.notificar_avaliacao_recebida()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_client uuid;
  v_nome text;
  v_prof uuid;
  v_corpo text;
  v_chave text := 'clientes.avaliacao:' || new.id;
  v_dados jsonb := jsonb_build_object('avaliacao', new.id, 'atendimento', new.attendance_id);
begin
  begin
    select at.client_id, split_part(btrim(cl.name), ' ', 1) into v_client, v_nome
      from public.attendance at join public.client cl on cl.id = at.client_id where at.id = new.attendance_id;
    v_corpo := format('%s deu %s %s.', v_nome, trim_scale(new.stars), case when new.stars = 1 then 'estrela' else 'estrelas' end)
      || case when nullif(btrim(new.comment), '') is not null then ' “' || left(btrim(new.comment), 90) || case when length(btrim(new.comment)) > 90 then '…' else '' end || '”' else '' end;
    for v_prof in select distinct ai.professional_id from public.attendance_item ai where ai.attendance_id = new.attendance_id and ai.professional_id is not null loop
      perform public.notificar_profissional(v_prof, 'clientes.avaliacao', 'Avaliação recebida', v_corpo, '/atendimento/' || new.attendance_id, v_dados, v_chave);
    end loop;
    perform public.notificar_gestores(new.company_id, 'clientes.avaliacao', 'Avaliação recebida', v_corpo, '/clientes/' || v_client, v_dados, v_chave);
  exception when others then
    raise warning 'notificacao avaliacao falhou: %', sqlerrm;
  end;
  return null;
end;
$function$;

create trigger notificar_avaliacao_recebida
  after insert on public.attendance_rating
  for each row execute function public.notificar_avaliacao_recebida();

-- Cliente criou conta na página da barbearia (não dispara para cadastro
-- feito pela equipe nem para importação: esses não criam client_identity).
create or replace function public.notificar_cliente_novo()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  begin
    perform public.notificar_gestores(new.company_id, 'clientes.novo', 'Novo cliente com conta',
      (select format('%s criou conta na página da barbearia.', split_part(btrim(cl.name), ' ', 1)) from public.client cl where cl.id = new.client_id),
      '/clientes/' || new.client_id, jsonb_build_object('cliente', new.client_id), 'clientes.novo:' || new.id);
  exception when others then
    raise warning 'notificacao cliente novo falhou: %', sqlerrm;
  end;
  return null;
end;
$function$;

create trigger notificar_cliente_novo
  after insert on public.client_identity
  for each row execute function public.notificar_cliente_novo();

-- ---------------------------------------------------------------------------
-- 5. Financeiro — fechamento de caixa
-- ---------------------------------------------------------------------------
create or replace function public.notificar_caixa_fechado()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_ator uuid := coalesce(new.closed_by, auth.uid());
  v_quem text;
begin
  if new.status is not distinct from old.status or new.closed_at is null or old.closed_at is not null then
    return null;
  end if;
  begin
    select split_part(btrim(pr.name), ' ', 1) into v_quem from public.professional pr where pr.user_id = v_ator and pr.company_id = new.company_id limit 1;
    if coalesce(new.difference, 0) <> 0 then
      perform public.notificar_gestores(new.company_id, 'financeiro.caixa_diferenca', 'Caixa fechado com diferença',
        format('%s fechou o caixa com %s de %s.', coalesce(v_quem, 'A equipe'),
          case when new.difference < 0 then 'falta' else 'sobra' end,
          public.notificacao_reais(abs(new.difference))),
        '/caixa', jsonb_build_object('caixa', new.id), 'financeiro.caixa:' || new.id, v_ator);
    else
      perform public.notificar_gestores(new.company_id, 'financeiro.caixa_fechado', 'Caixa fechado',
        format('%s fechou o caixa sem diferença.', coalesce(v_quem, 'A equipe')),
        '/caixa', jsonb_build_object('caixa', new.id), 'financeiro.caixa:' || new.id, v_ator);
    end if;
  exception when others then
    raise warning 'notificacao caixa falhou: %', sqlerrm;
  end;
  return null;
end;
$function$;

create trigger notificar_caixa_fechado
  after update of status on public.cash_session
  for each row execute function public.notificar_caixa_fechado();

-- ---------------------------------------------------------------------------
-- 6. Estoque — só quando cruza o limite (não a cada venda)
-- ---------------------------------------------------------------------------
create or replace function public.notificar_estoque()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_tipo text;
  v_url text := case when tg_table_name = 'product' then '/produtos/' else '/materiais/' end || new.id;
  v_dia text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYYMMDD');
begin
  if not new.active or new.current_stock is not distinct from old.current_stock or new.current_stock >= old.current_stock then
    return null;
  end if;
  begin
    if new.current_stock <= 0 and old.current_stock > 0 then
      v_tipo := 'estoque.sem_estoque';
      perform public.notificar_gestores(new.company_id, v_tipo, 'Sem estoque: ' || left(new.name, 60),
        'Acabou. Registre uma entrada quando repor.', v_url, jsonb_build_object('item', new.id, 'tabela', tg_table_name),
        v_tipo || ':' || new.id || ':' || v_dia);
    elsif new.minimum_stock > 0 and new.current_stock <= new.minimum_stock and old.current_stock > new.minimum_stock then
      v_tipo := 'estoque.baixo';
      perform public.notificar_gestores(new.company_id, v_tipo, 'Estoque baixo: ' || left(new.name, 60),
        format('Restam %s (mínimo %s).', trim_scale(new.current_stock), trim_scale(new.minimum_stock)), v_url,
        jsonb_build_object('item', new.id, 'tabela', tg_table_name), v_tipo || ':' || new.id || ':' || v_dia);
    end if;
  exception when others then
    raise warning 'notificacao estoque falhou: %', sqlerrm;
  end;
  return null;
end;
$function$;

create trigger notificar_estoque
  after update of current_stock on public.product
  for each row execute function public.notificar_estoque();
create trigger notificar_estoque
  after update of current_stock on public.consumable
  for each row execute function public.notificar_estoque();

-- ---------------------------------------------------------------------------
-- 7. Equipe
-- ---------------------------------------------------------------------------
-- Comissões pagas: um aviso por profissional por pagamento, mesmo quando o
-- dono paga várias de uma vez (trigger por comando, não por linha).
create or replace function public.notificar_comissoes_pagas()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  g record;
begin
  begin
    for g in
      select n.professional_id, count(*) as qtd, sum(n.amount) as total, min(n.id::text) as ref
        from novas n join antigas o on o.id = n.id
       where n.status = 'paid' and o.status <> 'paid'
       group by n.professional_id
    loop
      perform public.notificar_profissional(g.professional_id, 'equipe.comissao_paga', 'Comissão paga',
        format('Você recebeu %s em %s %s.', public.notificacao_reais(g.total),
          g.qtd, case when g.qtd = 1 then 'comissão' else 'comissões' end),
        '/comissoes', jsonb_build_object('quantidade', g.qtd), 'equipe.comissao_paga:' || g.ref, auth.uid());
    end loop;
  exception when others then
    raise warning 'notificacao comissao falhou: %', sqlerrm;
  end;
  return null;
end;
$function$;

create trigger notificar_comissoes_pagas
  after update on public.commission
  referencing old table as antigas new table as novas
  for each statement execute function public.notificar_comissoes_pagas();

-- Acesso mudou: a pessoa afetada recebe aviso de segurança (obrigatório) e a
-- gerência recebe aviso de equipe. Quem fez a mudança não é avisado.
create or replace function public.notificar_acesso()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_ator uuid := auth.uid();
  v_linha record;
  v_papel text;
  v_rotulo text;
  v_empresa text;
  v_nome text;
  v_publico text;
  v_texto text;
  v_chave text;
begin
  if tg_op = 'UPDATE' then
    if new.role_id is not distinct from old.role_id then
      return null;
    end if;
  end if;
  if tg_op = 'DELETE' then v_linha := old; else v_linha := new; end if;
  v_chave := 'acesso:' || v_linha.id || ':' || lower(tg_op) || ':' || extract(epoch from now())::bigint;
  begin
    select r.key into v_papel from public.role r where r.id = v_linha.role_id;
    v_rotulo := case v_papel when 'owner' then 'responsável' when 'admin' then 'gerência' else 'profissional' end;
    v_publico := case when v_papel in ('owner', 'admin') then 'gestor' else 'profissional' end;
    select coalesce(nullif(btrim(c.trade_name), ''), c.name) into v_empresa from public.company c where c.id = v_linha.company_id;
    select split_part(btrim(pr.name), ' ', 1) into v_nome from public.professional pr where pr.user_id = v_linha.user_id and pr.company_id = v_linha.company_id limit 1;

    v_texto := case tg_op
      when 'INSERT' then format('Você agora tem acesso à %s como %s.', v_empresa, v_rotulo)
      when 'DELETE' then format('Seu acesso à %s foi removido.', v_empresa)
      else format('Seu acesso à %s mudou para %s.', v_empresa, v_rotulo) end;
    if v_linha.user_id is distinct from v_ator then
      -- sem empresa: vale também para quem acabou de perder o acesso
      perform public.notificar('sistema.seguranca', v_linha.user_id, null, v_publico, 'Mudança no seu acesso', v_texto,
        null, jsonb_build_object('empresa', v_linha.company_id), v_chave || ':' || v_linha.user_id);
    end if;

    perform public.notificar_gestores(v_linha.company_id, 'equipe.acesso', 'Acesso da equipe mudou',
      case tg_op
        when 'INSERT' then format('%s agora tem acesso como %s.', coalesce(v_nome, 'Uma pessoa'), v_rotulo)
        when 'DELETE' then format('%s não tem mais acesso.', coalesce(v_nome, 'Uma pessoa'))
        else format('%s agora é %s.', coalesce(v_nome, 'Uma pessoa'), v_rotulo) end,
      '/profissionais', jsonb_build_object('usuario', v_linha.user_id), v_chave, coalesce(v_ator, v_linha.user_id));
  exception when others then
    raise warning 'notificacao acesso falhou: %', sqlerrm;
  end;
  return null;
end;
$function$;

create trigger notificar_acesso
  after insert or update or delete on public.user_company_role
  for each row execute function public.notificar_acesso();

-- Profissional entrou ou saiu da equipe (ativo/inativo).
create or replace function public.notificar_equipe()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if tg_op = 'UPDATE' then
    if new.active is not distinct from old.active then
      return null;
    end if;
  end if;
  begin
    perform public.notificar_gestores(new.company_id, 'equipe.alteracao',
      case when tg_op = 'INSERT' or new.active then 'Profissional na equipe' else 'Profissional desativado' end,
      format('%s %s.', split_part(btrim(new.name), ' ', 1), case when tg_op = 'INSERT' then 'entrou para a equipe' when new.active then 'voltou para a equipe' else 'foi desativado' end),
      '/profissionais/' || new.id, jsonb_build_object('profissional', new.id),
      'equipe.alteracao:' || new.id || ':' || extract(epoch from now())::bigint, auth.uid());
  exception when others then
    raise warning 'notificacao equipe falhou: %', sqlerrm;
  end;
  return null;
end;
$function$;

create trigger notificar_equipe
  after insert or update of active on public.professional
  for each row execute function public.notificar_equipe();

-- Funções de trigger não são chamáveis por ninguém.
revoke all on function public.notificar_agendamento_novo() from public, anon, authenticated;
revoke all on function public.notificar_agendamento_status() from public, anon, authenticated;
revoke all on function public.notificar_reagendamento() from public, anon, authenticated;
revoke all on function public.notificar_pedido_de_avaliacao() from public, anon, authenticated;
revoke all on function public.notificar_avaliacao_recebida() from public, anon, authenticated;
revoke all on function public.notificar_cliente_novo() from public, anon, authenticated;
revoke all on function public.notificar_caixa_fechado() from public, anon, authenticated;
revoke all on function public.notificar_estoque() from public, anon, authenticated;
revoke all on function public.notificar_comissoes_pagas() from public, anon, authenticated;
revoke all on function public.notificar_acesso() from public, anon, authenticated;
revoke all on function public.notificar_equipe() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Agendados (pg_cron)
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;

select cron.schedule('notificacoes-lembretes-agenda', '*/10 * * * *', $$select public.notificar_lembretes_de_agenda()$$);

-- Histórico: notificação lida/arquivada some depois de 180 dias; entregas
-- técnicas depois de 30. Não é auditoria (auditoria vive em audit_log).
select cron.schedule('notificacoes-limpeza', '17 4 * * *', $$
  delete from public.notificacao_entrega where criada_em < now() - interval '30 days';
  delete from public.notificacao where criada_em < now() - interval '180 days' and (lida_em is not null or arquivada_em is not null);
  delete from public.notificacao_dispositivo where invalido_em < now() - interval '60 days';
$$);
