-- Notificações do CORTEX — comunicados do Admin e pesquisas enviadas.
--
-- O Admin de plataforma cria um comunicado (título, mensagem, tipo,
-- prioridade, destino, ação, data), e o banco entrega a quem tem o papel
-- de destino — sempre passando por notificar(), que respeita preferência,
-- deduplica e cria o push. Uma pesquisa publicada pode virar comunicado UMA
-- vez; o funil passa a ser enviados → abertos → iniciados → respondidos.
--
-- Anti-spam (produto não é marketing):
--   * pesquisa/novidade/beta: no máximo 2 por pessoa a cada 7 dias (o resto
--     entra em "limitados" e não recebe);
--   * no máximo 3 comunicados de produto por dia na plataforma inteira;
--   * "critical" só para manutenção; produto nunca passa de "normal";
--   * quem já respondeu ou dispensou a pesquisa não recebe o aviso.
--
-- Nada disto é chamável por quem não é admin de plataforma; o endpoint
-- público não dispara nada (só entrega o que já foi decidido aqui).

-- ---------------------------------------------------------------------------
-- 1. Funil da pesquisa
-- ---------------------------------------------------------------------------
alter table public.pesquisa_participacao add column if not exists recebida_em timestamptz;
alter table public.pesquisa_participacao add column if not exists iniciada_em timestamptz;
-- quem só RECEBEU o aviso ainda não viu a pesquisa
alter table public.pesquisa_participacao alter column exibida_em drop not null;

create or replace function public.marcar_pesquisa_exibida(p_pesquisa_id uuid, p_area text, p_company_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_publico text := public.publico_da_pesquisa(p_area, p_company_id);
begin
  if v_publico is null or not exists (
    select 1 from public.pesquisa p
     where p.id = p_pesquisa_id and p.status = 'publicada' and v_publico = any (p.publico)
  ) then
    raise exception 'PESQUISA_INDISPONIVEL' using errcode = '42501';
  end if;

  insert into public.pesquisa_participacao (pesquisa_id, user_id, company_id, publico, exibida_em)
  values (p_pesquisa_id, auth.uid(), p_company_id, v_publico, now())
  on conflict (pesquisa_id, user_id) do update
    set exibida_em = coalesce(pesquisa_participacao.exibida_em, now());
end;
$function$;

-- Primeira interação com a resposta (tocou numa opção, começou a escrever).
create or replace function public.marcar_pesquisa_iniciada(p_pesquisa_id uuid, p_area text, p_company_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_publico text := public.publico_da_pesquisa(p_area, p_company_id);
begin
  if v_publico is null or not exists (
    select 1 from public.pesquisa p
     where p.id = p_pesquisa_id and p.status = 'publicada' and v_publico = any (p.publico)
  ) then
    raise exception 'PESQUISA_INDISPONIVEL' using errcode = '42501';
  end if;

  insert into public.pesquisa_participacao (pesquisa_id, user_id, company_id, publico, exibida_em, iniciada_em)
  values (p_pesquisa_id, auth.uid(), p_company_id, v_publico, now(), now())
  on conflict (pesquisa_id, user_id) do update
    set iniciada_em = coalesce(pesquisa_participacao.iniciada_em, now()),
        exibida_em = coalesce(pesquisa_participacao.exibida_em, now());
end;
$function$;

-- A pesquisa aberta pelo aviso (página própria). Mesmo público da discreta;
-- diz também se a pessoa já respondeu, para a tela agradecer em vez de
-- mostrar o formulário de novo.
create or replace function public.pesquisa_para_responder(p_pesquisa_id uuid, p_area text, p_company_id uuid)
returns table(id uuid, titulo text, pergunta text, tipo text, opcoes jsonb, permite_comentario boolean, publico text, situacao text)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_publico text := public.publico_da_pesquisa(p_area, p_company_id);
begin
  if v_publico is null then
    return;
  end if;
  return query
    select p.id, p.titulo, p.pergunta, p.tipo, p.opcoes, p.permite_comentario, v_publico,
           case
             when exists (select 1 from public.pesquisa_participacao pp where pp.pesquisa_id = p.id and pp.user_id = auth.uid() and pp.respondida_em is not null) then 'respondida'
             when p.status <> 'publicada' or p.publicar_em > now() or (p.encerrar_em is not null and p.encerrar_em <= now()) then 'encerrada'
             else 'aberta'
           end
      from public.pesquisa p
     where p.id = p_pesquisa_id
       and p.status in ('publicada', 'encerrada')
       and v_publico = any (p.publico);
end;
$function$;

revoke all on function public.marcar_pesquisa_iniciada(uuid, text, uuid) from public, anon;
revoke all on function public.pesquisa_para_responder(uuid, text, uuid) from public, anon;
grant execute on function public.marcar_pesquisa_iniciada(uuid, text, uuid) to authenticated;
grant execute on function public.pesquisa_para_responder(uuid, text, uuid) to authenticated;

-- "Exibições" passam a contar só quem viu de fato (receber o aviso não conta).
create or replace function public.admin_listar_pesquisas()
returns table(id uuid, titulo text, pergunta text, tipo text, opcoes jsonb, permite_comentario boolean, funcionalidade text, publico text[], status text, publicar_em timestamptz, encerrar_em timestamptz, criada_em timestamptz, publicada_em timestamptz, encerrada_em timestamptz, exibicoes bigint, respostas bigint, dispensas bigint, ultima_resposta timestamptz)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
    select p.id, p.titulo, p.pergunta, p.tipo, p.opcoes, p.permite_comentario, p.funcionalidade, p.publico,
           case when p.status = 'publicada' and p.encerrar_em is not null and p.encerrar_em <= now() then 'encerrada' else p.status end,
           p.publicar_em, p.encerrar_em, p.criada_em, p.publicada_em, coalesce(p.encerrada_em, case when p.status = 'publicada' and p.encerrar_em <= now() then p.encerrar_em end),
           count(pp.exibida_em), count(pp.respondida_em), count(pp.dispensada_em), max(pp.respondida_em)
      from public.pesquisa p
      left join public.pesquisa_participacao pp on pp.pesquisa_id = p.id
     group by p.id
     order by case p.status when 'publicada' then 0 when 'rascunho' then 1 else 2 end, p.criada_em desc;
end;
$function$;

create or replace function public.admin_resultado_pesquisa(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_tipo text;
  v_resultado jsonb;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select tipo into v_tipo from public.pesquisa where id = p_id;
  if v_tipo is null then
    raise exception 'PESQUISA_NAO_ENCONTRADA' using errcode = 'P0002';
  end if;

  with r as (
    select pp.* from public.pesquisa_participacao pp where pp.pesquisa_id = p_id
  ),
  respondidas as (select * from r where respondida_em is not null),
  valores as (
    select case when v_tipo = 'multipla' then e.v else respondidas.valor end as v, respondidas.publico
      from respondidas
      left join lateral jsonb_array_elements(case when v_tipo = 'multipla' then respondidas.valor else '[]'::jsonb end) as e(v) on true
     where v_tipo <> 'texto'
  )
  select jsonb_build_object(
    'enviados', (select count(*) from r where recebida_em is not null),
    'exibicoes', (select count(*) from r where exibida_em is not null),
    'iniciados', (select count(*) from r where iniciada_em is not null or respondida_em is not null),
    'respostas', (select count(*) from respondidas),
    'dispensas', (select count(*) from r where dispensada_em is not null),
    'empresas', (select count(distinct company_id) from respondidas),
    'media', case when v_tipo = 'nota' then (select round(avg((valor #>> '{}')::numeric), 2) from respondidas) end,
    'por_publico', coalesce((
      select jsonb_object_agg(publico, jsonb_build_object('enviados', env, 'exibicoes', total, 'iniciados', ini, 'respostas', resp))
        from (select publico, count(recebida_em) env, count(exibida_em) total,
                     count(*) filter (where iniciada_em is not null or respondida_em is not null) ini, count(respondida_em) resp
                from r group by publico) x
    ), '{}'::jsonb),
    'distribuicao', coalesce((
      select jsonb_agg(jsonb_build_object('valor', v, 'total', total, 'por_publico', pp) order by total desc)
        from (
          select v, count(*) total, jsonb_object_agg(publico, n) pp
            from (select v, publico, count(*) n from valores group by v, publico) y
           group by v
        ) z
    ), '[]'::jsonb),
    'comentarios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'texto', coalesce(case when v_tipo = 'texto' then respondidas.valor #>> '{}' end, respondidas.comentario),
               'complemento', case when v_tipo = 'texto' then respondidas.comentario end,
               'valor', case when v_tipo <> 'texto' then respondidas.valor end,
               'publico', respondidas.publico,
               'empresa', c.name,
               'em', respondidas.respondida_em
             ) order by respondidas.respondida_em desc)
        from respondidas left join public.company c on c.id = respondidas.company_id
       where v_tipo = 'texto' or respondidas.comentario is not null
    ), '[]'::jsonb)
  ) into v_resultado;

  return v_resultado;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Regras do comunicado
-- ---------------------------------------------------------------------------
create or replace function public.comunicado_prioridade_permitida(p_tipo text, p_prioridade text)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  select case
    when p_tipo like 'produto.%' then p_prioridade in ('informational', 'normal')
    when p_tipo = 'sistema.atualizacao' then p_prioridade in ('informational', 'normal', 'important')
    when p_tipo = 'sistema.manutencao' then p_prioridade in ('important', 'critical')
    else false
  end;
$function$;

-- Quem recebe: uma linha por pessoa (e público). Comunicado geral: sem
-- empresa (aparece em qualquer barbearia da pessoa). Para empresas
-- escolhidas, ou pesquisa: com a empresa (a pesquisa é respondida nela).
create or replace function public.comunicado_destinatarios(p_papeis text[], p_empresas uuid[], p_por_empresa boolean)
returns table(user_id uuid, company_id uuid, publico text, slug text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with equipe as (
    select ucr.user_id, ucr.company_id, c.slug, c.created_at,
           case when r.key in ('owner', 'admin') then 'gestor' else 'profissional' end as publico,
           case r.key when 'owner' then 0 when 'admin' then 1 else 2 end as ordem
      from public.user_company_role ucr
      join public.role r on r.id = ucr.role_id
      join public.company c on c.id = ucr.company_id and c.status = 'active'
     where r.key = any (p_papeis)
       and (p_empresas is null or ucr.company_id = any (p_empresas))
  ),
  clientes as (
    select ci.user_id, ci.company_id, c.slug, ci.created_at, 'cliente'::text as publico, 3 as ordem
      from public.client_identity ci
      join public.company c on c.id = ci.company_id and c.status = 'active'
     where 'cliente' = any (p_papeis)
       and (p_empresas is null or ci.company_id = any (p_empresas))
  ),
  todos as (select * from equipe union all select * from clientes)
  select distinct on (t.user_id, case when t.publico = 'cliente' then 1 else 0 end)
         t.user_id, case when p_por_empresa or t.publico = 'cliente' then t.company_id end, t.publico, t.slug
    from todos t
   order by t.user_id, case when t.publico = 'cliente' then 1 else 0 end, t.ordem, t.created_at desc;
$function$;

revoke all on function public.comunicado_destinatarios(text[], uuid[], boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Disparo (interno; chamado pelo Admin ou pelo cron)
-- ---------------------------------------------------------------------------
create or replace function public.comunicado_disparar(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  c public.notificacao_comunicado%rowtype;
  d record;
  v_categoria text;
  v_url text;
  v_n int := 0;
  v_limitados int := 0;
  v_ignorados int := 0;
  v_id uuid;
  v_publicos_pesquisa text[];
begin
  select * into c from public.notificacao_comunicado where id = p_id for update;
  if not found or c.status not in ('rascunho', 'agendado', 'enviando') then
    raise exception 'COMUNICADO_INDISPONIVEL' using errcode = '22023';
  end if;
  update public.notificacao_comunicado set status = 'enviando' where id = p_id;
  select categoria into v_categoria from public.notificacao_tipo where chave = c.tipo;

  if c.pesquisa_id is not null then
    select publico into v_publicos_pesquisa from public.pesquisa where id = c.pesquisa_id and status = 'publicada';
    if v_publicos_pesquisa is null then
      raise exception 'PESQUISA_NAO_PUBLICADA' using errcode = '22023';
    end if;
  end if;

  for d in select * from public.comunicado_destinatarios(c.papeis, c.empresas, c.empresas is not null or c.pesquisa_id is not null) loop
    -- pesquisa: só o público dela, e nunca para quem já respondeu/dispensou
    if c.pesquisa_id is not null then
      if not (d.publico = any (v_publicos_pesquisa)) then
        continue;
      end if;
      if exists (select 1 from public.pesquisa_participacao pp
                  where pp.pesquisa_id = c.pesquisa_id and pp.user_id = d.user_id
                    and (pp.respondida_em is not null or pp.dispensada_em is not null)) then
        v_ignorados := v_ignorados + 1;
        continue;
      end if;
    end if;

    -- limite por pessoa: produto no máximo 2 a cada 7 dias
    if v_categoria = 'produto' and (
      select count(*) from public.notificacao n
       where n.user_id = d.user_id and n.categoria = 'produto' and n.comunicado_id is not null
         and n.criada_em > now() - interval '7 days'
    ) >= 2 then
      v_limitados := v_limitados + 1;
      continue;
    end if;

    v_url := case
      when c.pesquisa_id is not null and d.publico = 'cliente' then '/' || d.slug || '/minha-conta/pesquisa/' || c.pesquisa_id
      when c.pesquisa_id is not null then '/pesquisa/' || c.pesquisa_id
      else c.url
    end;

    v_id := public.notificar(c.tipo, d.user_id, d.company_id, d.publico, c.titulo, c.mensagem, v_url,
      jsonb_build_object('comunicado', c.id), 'comunicado:' || c.id || ':' || d.user_id, c.prioridade, c.id, c.pesquisa_id);

    if v_id is null then
      v_ignorados := v_ignorados + 1; -- preferência desligada ou já recebido
      continue;
    end if;
    v_n := v_n + 1;

    if c.pesquisa_id is not null then
      insert into public.pesquisa_participacao (pesquisa_id, user_id, company_id, publico, recebida_em, exibida_em)
      values (c.pesquisa_id, d.user_id, d.company_id, d.publico, now(), null)
      on conflict (pesquisa_id, user_id) do update
        set recebida_em = coalesce(pesquisa_participacao.recebida_em, now());
    end if;
  end loop;

  update public.notificacao_comunicado
     set status = 'enviado', enviado_em = now(), destinatarios = v_n, limitados = v_limitados, ignorados = v_ignorados
   where id = p_id;

  return jsonb_build_object('destinatarios', v_n, 'limitados', v_limitados, 'ignorados', v_ignorados);
end;
$function$;

revoke all on function public.comunicado_disparar(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Funções do Admin (is_platform_admin + auditoria)
-- ---------------------------------------------------------------------------
create or replace function public.admin_salvar_comunicado(
  p_id uuid, p_titulo text, p_mensagem text, p_tipo text, p_prioridade text, p_url text,
  p_papeis text[], p_empresas uuid[], p_enviar_em timestamptz
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid;
  v_antes jsonb;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.notificacao_tipo t where t.chave = p_tipo and t.comunicavel) then
    raise exception 'TIPO_NAO_COMUNICAVEL' using errcode = '22023';
  end if;
  if not public.comunicado_prioridade_permitida(p_tipo, p_prioridade) then
    raise exception 'PRIORIDADE_NAO_PERMITIDA' using errcode = '22023';
  end if;
  if p_url is not null and (p_url !~ '^/[A-Za-z0-9]' or p_url ~ '[\s\\]' or length(p_url) > 300) then
    raise exception 'URL_INVALIDA' using errcode = '22023';
  end if;
  if p_papeis is null or cardinality(p_papeis) = 0 or not (p_papeis <@ array['owner', 'admin', 'staff', 'cliente']) then
    raise exception 'DESTINO_INVALIDO' using errcode = '22023';
  end if;
  if p_empresas is not null and cardinality(p_empresas) = 0 then
    p_empresas := null;
  end if;
  if p_enviar_em is not null and p_enviar_em < now() - interval '1 minute' then
    raise exception 'DATA_NO_PASSADO' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.notificacao_comunicado (titulo, mensagem, tipo, prioridade, url, papeis, empresas, enviar_em, criado_por)
    values (btrim(p_titulo), btrim(p_mensagem), p_tipo, p_prioridade, p_url, p_papeis, p_empresas, p_enviar_em, auth.uid())
    returning id into v_id;
  else
    select to_jsonb(nc) into v_antes from public.notificacao_comunicado nc where nc.id = p_id and nc.status = 'rascunho' and nc.pesquisa_id is null;
    if v_antes is null then
      raise exception 'COMUNICADO_NAO_EDITAVEL' using errcode = '22023';
    end if;
    update public.notificacao_comunicado
       set titulo = btrim(p_titulo), mensagem = btrim(p_mensagem), tipo = p_tipo, prioridade = p_prioridade, url = p_url,
           papeis = p_papeis, empresas = p_empresas, enviar_em = p_enviar_em
     where id = p_id
    returning id into v_id;
  end if;

  perform public.write_platform_audit_log('notification_campaign_saved', 'notification_campaign', v_id, v_antes,
    jsonb_build_object('titulo', p_titulo, 'tipo', p_tipo, 'prioridade', p_prioridade, 'papeis', p_papeis, 'empresas', p_empresas, 'enviar_em', p_enviar_em), null);
  return v_id;
end;
$function$;

-- Envia agora (ou agenda, se enviar_em estiver no futuro).
create or replace function public.admin_enviar_comunicado(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  c public.notificacao_comunicado%rowtype;
  v_categoria text;
  v_resultado jsonb;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into c from public.notificacao_comunicado where id = p_id for update;
  if not found or c.status not in ('rascunho', 'agendado') then
    raise exception 'COMUNICADO_INDISPONIVEL' using errcode = '22023';
  end if;
  select categoria into v_categoria from public.notificacao_tipo where chave = c.tipo;

  if c.enviar_em is not null and c.enviar_em > now() + interval '1 minute' then
    update public.notificacao_comunicado set status = 'agendado' where id = p_id;
    perform public.write_platform_audit_log('notification_campaign_scheduled', 'notification_campaign', p_id, null,
      jsonb_build_object('enviar_em', c.enviar_em), null);
    return jsonb_build_object('agendado', c.enviar_em);
  end if;

  -- a plataforma inteira: no máximo 3 comunicados de produto por dia
  if v_categoria = 'produto' and (
    select count(*) from public.notificacao_comunicado nc
      join public.notificacao_tipo t on t.chave = nc.tipo
     where t.categoria = 'produto' and nc.status = 'enviado' and nc.enviado_em > now() - interval '24 hours'
  ) >= 3 then
    raise exception 'LIMITE_DE_ENVIOS' using errcode = '22023';
  end if;

  v_resultado := public.comunicado_disparar(p_id);
  perform public.write_platform_audit_log('notification_campaign_sent', 'notification_campaign', p_id, null, v_resultado, null);
  return v_resultado;
end;
$function$;

create or replace function public.admin_cancelar_comunicado(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.notificacao_comunicado set status = 'cancelado'
   where id = p_id and status in ('rascunho', 'agendado');
  if not found then
    raise exception 'COMUNICADO_INDISPONIVEL' using errcode = '22023';
  end if;
  perform public.write_platform_audit_log('notification_campaign_cancelled', 'notification_campaign', p_id, null, null, null);
end;
$function$;

-- Pesquisa publicada → comunicado (uma vez por pesquisa).
create or replace function public.admin_enviar_pesquisa(p_pesquisa_id uuid, p_titulo text, p_mensagem text, p_empresas uuid[], p_enviar_em timestamptz)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_pesquisa public.pesquisa%rowtype;
  v_papeis text[] := '{}';
  v_id uuid;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into v_pesquisa from public.pesquisa where id = p_pesquisa_id;
  if not found or v_pesquisa.status <> 'publicada' or (v_pesquisa.encerrar_em is not null and v_pesquisa.encerrar_em <= now()) then
    raise exception 'PESQUISA_NAO_PUBLICADA' using errcode = '22023';
  end if;
  if exists (select 1 from public.notificacao_comunicado nc where nc.pesquisa_id = p_pesquisa_id and nc.status <> 'cancelado') then
    raise exception 'PESQUISA_JA_ENVIADA' using errcode = '23505';
  end if;
  if 'gestor' = any (v_pesquisa.publico) then v_papeis := v_papeis || array['owner', 'admin']; end if;
  if 'profissional' = any (v_pesquisa.publico) then v_papeis := v_papeis || array['staff']; end if;
  if 'cliente' = any (v_pesquisa.publico) then v_papeis := v_papeis || array['cliente']; end if;
  if p_empresas is not null and cardinality(p_empresas) = 0 then
    p_empresas := null;
  end if;

  insert into public.notificacao_comunicado (titulo, mensagem, tipo, prioridade, url, papeis, empresas, pesquisa_id, enviar_em, criado_por)
  values (btrim(p_titulo), btrim(p_mensagem), 'produto.pesquisa', 'informational', null, v_papeis, p_empresas, p_pesquisa_id, p_enviar_em, auth.uid())
  returning id into v_id;

  perform public.write_platform_audit_log('survey_notification_created', 'notification_campaign', v_id, null,
    jsonb_build_object('pesquisa', p_pesquisa_id, 'papeis', v_papeis, 'empresas', p_empresas), null);
  return jsonb_build_object('comunicado', v_id) || public.admin_enviar_comunicado(v_id);
end;
$function$;

create or replace function public.admin_listar_comunicados()
returns table(
  id uuid, titulo text, mensagem text, tipo text, prioridade text, url text, papeis text[], empresas uuid[],
  pesquisa_id uuid, pesquisa_titulo text, enviar_em timestamptz, status text, criado_em timestamptz, enviado_em timestamptz,
  destinatarios int, limitados int, ignorados int, lidas bigint, abertas bigint, push_enviados bigint
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
    select nc.id, nc.titulo, nc.mensagem, nc.tipo, nc.prioridade, nc.url, nc.papeis, nc.empresas,
           nc.pesquisa_id, p.titulo, nc.enviar_em, nc.status, nc.criado_em, nc.enviado_em,
           nc.destinatarios, nc.limitados, nc.ignorados,
           (select count(*) from public.notificacao n where n.comunicado_id = nc.id and n.lida_em is not null),
           (select count(*) from public.notificacao n where n.comunicado_id = nc.id and n.aberta_em is not null),
           (select count(*) from public.notificacao n join public.notificacao_entrega e on e.notificacao_id = n.id
             where n.comunicado_id = nc.id and e.canal = 'push' and e.status = 'enviada')
      from public.notificacao_comunicado nc
      left join public.pesquisa p on p.id = nc.pesquisa_id
     order by nc.criado_em desc
     limit 200;
end;
$function$;

-- Prévia de alcance antes de enviar (quantas pessoas, por público).
create or replace function public.admin_previa_comunicado(p_papeis text[], p_empresas uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_object_agg(publico, n) from (
      select d.publico, count(*) n
        from public.comunicado_destinatarios(p_papeis, case when cardinality(p_empresas) = 0 then null else p_empresas end, false) d
       group by d.publico
    ) x
  ), '{}'::jsonb);
end;
$function$;

revoke all on function public.admin_salvar_comunicado(uuid, text, text, text, text, text, text[], uuid[], timestamptz) from public, anon;
revoke all on function public.admin_enviar_comunicado(uuid) from public, anon;
revoke all on function public.admin_cancelar_comunicado(uuid) from public, anon;
revoke all on function public.admin_enviar_pesquisa(uuid, text, text, uuid[], timestamptz) from public, anon;
revoke all on function public.admin_listar_comunicados() from public, anon;
revoke all on function public.admin_previa_comunicado(text[], uuid[]) from public, anon;
grant execute on function public.admin_salvar_comunicado(uuid, text, text, text, text, text, text[], uuid[], timestamptz) to authenticated;
grant execute on function public.admin_enviar_comunicado(uuid) to authenticated;
grant execute on function public.admin_cancelar_comunicado(uuid) to authenticated;
grant execute on function public.admin_enviar_pesquisa(uuid, text, text, uuid[], timestamptz) to authenticated;
grant execute on function public.admin_listar_comunicados() to authenticated;
grant execute on function public.admin_previa_comunicado(text[], uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Agendados
-- ---------------------------------------------------------------------------
create or replace function public.processar_comunicados_agendados()
returns int
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid;
  v_n int := 0;
begin
  for v_id in
    select nc.id from public.notificacao_comunicado nc
     where nc.status = 'agendado' and nc.enviar_em <= now()
     order by nc.enviar_em
     limit 10
  loop
    begin
      perform public.comunicado_disparar(v_id);
      v_n := v_n + 1;
    exception when others then
      raise warning 'comunicado % falhou: %', v_id, sqlerrm;
    end;
  end loop;
  return v_n;
end;
$function$;

revoke all on function public.processar_comunicados_agendados() from public, anon, authenticated;

select cron.schedule('notificacoes-comunicados-agendados', '*/5 * * * *', $$select public.processar_comunicados_agendados()$$);
