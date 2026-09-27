-- Pesquisas in-app e inteligência do beta.
--
-- Pesquisa: criada e publicada pela administração da plataforma, exibida de
-- forma discreta para um público (gestor, profissional, cliente), nunca
-- repetida para quem respondeu ou dispensou.
--
-- Autorização toda aqui: as tabelas não têm política para anon/authenticated;
-- só as funções abaixo leem e escrevem, e cada uma confere quem chama.
--   * público "gestor"       = papel owner/admin na empresa informada
--   * público "profissional" = papel staff na empresa informada
--   * público "cliente"      = conta de cliente (client_identity) na empresa
-- O público é decidido pelo banco a partir do vínculo real — o navegador só
-- diz em que área está (equipe ou cliente) e de qual empresa.

-- ---------------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------------
create table public.pesquisa (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(btrim(titulo)) between 3 and 80),
  pergunta text not null check (length(btrim(pergunta)) between 5 and 240),
  tipo text not null check (tipo in ('nota', 'sim_nao', 'escolha', 'multipla', 'texto')),
  opcoes jsonb not null default '[]'::jsonb check (jsonb_typeof(opcoes) = 'array'),
  permite_comentario boolean not null default false,
  funcionalidade text not null default 'geral' check (funcionalidade in (
    'geral', 'inicio', 'agenda', 'agendamento_publico', 'atendimento', 'nova_venda', 'caixa',
    'financeiro', 'comissoes', 'estoque', 'clientes', 'equipe', 'configuracoes',
    'onboarding', 'conta_cliente'
  )),
  publico text[] not null check (
    cardinality(publico) between 1 and 3
    and publico <@ array['gestor', 'profissional', 'cliente']::text[]
  ),
  status text not null default 'rascunho' check (status in ('rascunho', 'publicada', 'encerrada')),
  publicar_em timestamptz,
  encerrar_em timestamptz,
  criada_por uuid references auth.users(id) on delete set null,
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  publicada_em timestamptz,
  encerrada_em timestamptz,
  constraint pesquisa_opcoes_coerentes check (
    (tipo in ('escolha', 'multipla') and jsonb_array_length(opcoes) between 2 and 8)
    or (tipo not in ('escolha', 'multipla') and jsonb_array_length(opcoes) = 0)
  ),
  constraint pesquisa_janela_coerente check (encerrar_em is null or publicar_em is null or encerrar_em > publicar_em),
  constraint pesquisa_publicada_tem_data check (status = 'rascunho' or publicar_em is not null)
);

comment on table public.pesquisa is
  'Pesquisa in-app criada pela administração da plataforma. Público: gestor (owner/admin), profissional (staff), cliente (conta de cliente).';

-- Uma linha por pessoa e pesquisa: exibida, dispensada ou respondida. É o que
-- garante que a mesma pesquisa não volta, e dá a taxa de resposta real.
create table public.pesquisa_participacao (
  id uuid primary key default gen_random_uuid(),
  pesquisa_id uuid not null references public.pesquisa(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.company(id) on delete set null,
  publico text not null check (publico in ('gestor', 'profissional', 'cliente')),
  exibida_em timestamptz not null default now(),
  dispensada_em timestamptz,
  respondida_em timestamptz,
  valor jsonb,
  comentario text check (comentario is null or length(comentario) <= 1000),
  unique (pesquisa_id, user_id),
  constraint participacao_resposta_coerente check (
    (respondida_em is null and valor is null and comentario is null)
    or (respondida_em is not null and valor is not null)
  )
);

create index pesquisa_participacao_pesquisa_idx on public.pesquisa_participacao (pesquisa_id) where respondida_em is not null;
create index pesquisa_participacao_empresa_idx on public.pesquisa_participacao (company_id) where respondida_em is not null;
create index pesquisa_ativa_idx on public.pesquisa (publicar_em) where status = 'publicada';

alter table public.pesquisa enable row level security;
alter table public.pesquisa_participacao enable row level security;
revoke all on public.pesquisa from anon, authenticated;
revoke all on public.pesquisa_participacao from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Público de quem chama, no contexto informado
-- ---------------------------------------------------------------------------
create or replace function public.publico_da_pesquisa(p_area text, p_company_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select case
    when auth.uid() is null or p_company_id is null then null
    when p_area = 'equipe' then (
      select case when bool_or(r.key in ('owner', 'admin')) then 'gestor'
                  when bool_or(r.key = 'staff') then 'profissional' end
        from public.user_company_role ucr
        join public.role r on r.id = ucr.role_id
        join public.company c on c.id = ucr.company_id
       where ucr.user_id = auth.uid() and ucr.company_id = p_company_id and c.status = 'active'
    )
    when p_area = 'cliente' then (
      select 'cliente' from public.client_identity ci
       where ci.user_id = auth.uid() and ci.company_id = p_company_id
       limit 1
    )
  end;
$function$;

revoke all on function public.publico_da_pesquisa(text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Lado de quem responde
-- ---------------------------------------------------------------------------

-- A próxima pesquisa para esta pessoa, neste contexto — no máximo uma.
create or replace function public.pesquisa_pendente(p_area text, p_company_id uuid)
returns table(id uuid, titulo text, pergunta text, tipo text, opcoes jsonb, permite_comentario boolean, publico text)
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
    select p.id, p.titulo, p.pergunta, p.tipo, p.opcoes, p.permite_comentario, v_publico
      from public.pesquisa p
     where p.status = 'publicada'
       and p.publicar_em <= now()
       and (p.encerrar_em is null or p.encerrar_em > now())
       and v_publico = any (p.publico)
       and not exists (
         select 1 from public.pesquisa_participacao pp
          where pp.pesquisa_id = p.id and pp.user_id = auth.uid()
            and (pp.respondida_em is not null or pp.dispensada_em is not null)
       )
     order by p.publicar_em, p.criada_em
     limit 1;
end;
$function$;

-- Validação da resposta pelo tipo da pesquisa. Devolve o valor normalizado.
create or replace function public.validar_resposta_pesquisa(p_tipo text, p_opcoes jsonb, p_valor jsonb)
returns jsonb
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_n int;
begin
  if p_valor is null then
    raise exception 'RESPOSTA_OBRIGATORIA' using errcode = '22023';
  end if;

  if p_tipo = 'nota' then
    if jsonb_typeof(p_valor) <> 'number' then raise exception 'RESPOSTA_INVALIDA' using errcode = '22023'; end if;
    v_n := (p_valor #>> '{}')::numeric::int;
    if v_n::numeric <> (p_valor #>> '{}')::numeric or v_n not between 1 and 5 then
      raise exception 'RESPOSTA_INVALIDA' using errcode = '22023';
    end if;
    return to_jsonb(v_n);
  elsif p_tipo = 'sim_nao' then
    if jsonb_typeof(p_valor) <> 'boolean' then raise exception 'RESPOSTA_INVALIDA' using errcode = '22023'; end if;
    return p_valor;
  elsif p_tipo = 'escolha' then
    if jsonb_typeof(p_valor) <> 'string' or not (p_opcoes @> jsonb_build_array(p_valor)) then
      raise exception 'RESPOSTA_INVALIDA' using errcode = '22023';
    end if;
    return p_valor;
  elsif p_tipo = 'multipla' then
    if jsonb_typeof(p_valor) <> 'array' or jsonb_array_length(p_valor) = 0 or not (p_opcoes @> p_valor) then
      raise exception 'RESPOSTA_INVALIDA' using errcode = '22023';
    end if;
    -- sem repetição, na ordem das opções
    return (select jsonb_agg(o order by ord) from jsonb_array_elements(p_opcoes) with ordinality as t(o, ord) where p_valor @> jsonb_build_array(o));
  elsif p_tipo = 'texto' then
    if jsonb_typeof(p_valor) <> 'string' or length(btrim(p_valor #>> '{}')) = 0 or length(p_valor #>> '{}') > 1000 then
      raise exception 'RESPOSTA_INVALIDA' using errcode = '22023';
    end if;
    return to_jsonb(btrim(p_valor #>> '{}'));
  end if;

  raise exception 'RESPOSTA_INVALIDA' using errcode = '22023';
end;
$function$;

revoke all on function public.validar_resposta_pesquisa(text, jsonb, jsonb) from public, anon, authenticated;

-- Registra que a pesquisa apareceu (para a taxa de resposta). Idempotente.
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

  insert into public.pesquisa_participacao (pesquisa_id, user_id, company_id, publico)
  values (p_pesquisa_id, auth.uid(), p_company_id, v_publico)
  on conflict (pesquisa_id, user_id) do nothing;
end;
$function$;

-- Fechar sem responder: a mesma pesquisa não volta.
create or replace function public.dispensar_pesquisa(p_pesquisa_id uuid, p_area text, p_company_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_publico text := public.publico_da_pesquisa(p_area, p_company_id);
begin
  if v_publico is null or not exists (
    select 1 from public.pesquisa p where p.id = p_pesquisa_id and v_publico = any (p.publico)
  ) then
    raise exception 'PESQUISA_INDISPONIVEL' using errcode = '42501';
  end if;

  insert into public.pesquisa_participacao (pesquisa_id, user_id, company_id, publico, dispensada_em)
  values (p_pesquisa_id, auth.uid(), p_company_id, v_publico, now())
  on conflict (pesquisa_id, user_id) do update
    set dispensada_em = coalesce(pesquisa_participacao.dispensada_em, now())
    where pesquisa_participacao.respondida_em is null;
end;
$function$;

create or replace function public.responder_pesquisa(
  p_pesquisa_id uuid, p_area text, p_company_id uuid, p_valor jsonb, p_comentario text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_publico text := public.publico_da_pesquisa(p_area, p_company_id);
  v_pesquisa public.pesquisa%rowtype;
  v_valor jsonb;
  v_comentario text := nullif(btrim(coalesce(p_comentario, '')), '');
begin
  select * into v_pesquisa from public.pesquisa p
   where p.id = p_pesquisa_id
     and p.status = 'publicada'
     and p.publicar_em <= now()
     and (p.encerrar_em is null or p.encerrar_em > now());

  if not found or v_publico is null or not (v_publico = any (v_pesquisa.publico)) then
    raise exception 'PESQUISA_INDISPONIVEL' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.pesquisa_participacao pp
     where pp.pesquisa_id = p_pesquisa_id and pp.user_id = auth.uid() and pp.respondida_em is not null
  ) then
    raise exception 'PESQUISA_JA_RESPONDIDA' using errcode = '23505';
  end if;

  v_valor := public.validar_resposta_pesquisa(v_pesquisa.tipo, v_pesquisa.opcoes, p_valor);

  if v_comentario is not null and not v_pesquisa.permite_comentario then
    v_comentario := null;
  end if;
  if v_comentario is not null and length(v_comentario) > 1000 then
    raise exception 'COMENTARIO_LONGO' using errcode = '22023';
  end if;

  insert into public.pesquisa_participacao (pesquisa_id, user_id, company_id, publico, respondida_em, valor, comentario)
  values (p_pesquisa_id, auth.uid(), p_company_id, v_publico, now(), v_valor, v_comentario)
  on conflict (pesquisa_id, user_id) do update
    set respondida_em = now(), valor = excluded.valor, comentario = excluded.comentario,
        company_id = excluded.company_id, publico = excluded.publico, dispensada_em = null;
end;
$function$;

revoke all on function public.pesquisa_pendente(text, uuid) from public, anon;
revoke all on function public.marcar_pesquisa_exibida(uuid, text, uuid) from public, anon;
revoke all on function public.dispensar_pesquisa(uuid, text, uuid) from public, anon;
revoke all on function public.responder_pesquisa(uuid, text, uuid, jsonb, text) from public, anon;
grant execute on function public.pesquisa_pendente(text, uuid) to authenticated;
grant execute on function public.marcar_pesquisa_exibida(uuid, text, uuid) to authenticated;
grant execute on function public.dispensar_pesquisa(uuid, text, uuid) to authenticated;
grant execute on function public.responder_pesquisa(uuid, text, uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Administração da plataforma
-- ---------------------------------------------------------------------------

-- Criar ou editar. Pergunta, tipo, opções e público só mudam em rascunho —
-- depois de publicada, mudar a pergunta invalidaria as respostas já dadas.
create or replace function public.admin_salvar_pesquisa(
  p_id uuid,
  p_titulo text,
  p_pergunta text,
  p_tipo text,
  p_opcoes jsonb,
  p_permite_comentario boolean,
  p_funcionalidade text,
  p_publico text[],
  p_publicar_em timestamptz,
  p_encerrar_em timestamptz
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_antes public.pesquisa%rowtype;
  v_id uuid;
  v_opcoes jsonb := coalesce(p_opcoes, '[]'::jsonb);
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_tipo not in ('escolha', 'multipla') then
    v_opcoes := '[]'::jsonb;
  else
    select coalesce(jsonb_agg(to_jsonb(o) order by ord), '[]'::jsonb) into v_opcoes
      from (select distinct on (lower(btrim(x))) btrim(x) as o, ord
              from jsonb_array_elements_text(v_opcoes) with ordinality as t(x, ord)
             where length(btrim(x)) > 0
             order by lower(btrim(x)), ord) d;
  end if;

  if p_id is null then
    insert into public.pesquisa (titulo, pergunta, tipo, opcoes, permite_comentario, funcionalidade, publico, publicar_em, encerrar_em, criada_por)
    values (btrim(p_titulo), btrim(p_pergunta), p_tipo, v_opcoes, coalesce(p_permite_comentario, false),
            coalesce(p_funcionalidade, 'geral'), p_publico, p_publicar_em, p_encerrar_em, auth.uid())
    returning id into v_id;

    perform public.write_platform_audit_log('survey_created', 'survey', v_id, null,
      jsonb_build_object('titulo', btrim(p_titulo), 'publico', p_publico, 'funcionalidade', p_funcionalidade), null);
    return v_id;
  end if;

  select * into v_antes from public.pesquisa where id = p_id for update;
  if not found then
    raise exception 'PESQUISA_NAO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if v_antes.status = 'encerrada' then
    raise exception 'PESQUISA_ENCERRADA' using errcode = '22023';
  end if;

  if v_antes.status = 'rascunho' then
    update public.pesquisa set
      titulo = btrim(p_titulo), pergunta = btrim(p_pergunta), tipo = p_tipo, opcoes = v_opcoes,
      permite_comentario = coalesce(p_permite_comentario, false), funcionalidade = coalesce(p_funcionalidade, 'geral'),
      publico = p_publico, publicar_em = p_publicar_em, encerrar_em = p_encerrar_em, atualizada_em = now()
    where id = p_id;
  else
    -- publicada: só o título (interno) e a data de encerramento
    update public.pesquisa set titulo = btrim(p_titulo), encerrar_em = p_encerrar_em, atualizada_em = now()
    where id = p_id;
  end if;

  perform public.write_platform_audit_log('survey_updated', 'survey', p_id,
    jsonb_build_object('titulo', v_antes.titulo, 'encerrar_em', v_antes.encerrar_em),
    jsonb_build_object('titulo', btrim(p_titulo), 'encerrar_em', p_encerrar_em), null);
  return p_id;
end;
$function$;

create or replace function public.admin_mudar_status_pesquisa(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_antes public.pesquisa%rowtype;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_antes from public.pesquisa where id = p_id for update;
  if not found then
    raise exception 'PESQUISA_NAO_ENCONTRADA' using errcode = 'P0002';
  end if;

  if p_status = 'publicada' and v_antes.status = 'rascunho' then
    update public.pesquisa
       set status = 'publicada', publicar_em = coalesce(publicar_em, now()), publicada_em = now(), atualizada_em = now()
     where id = p_id;
  elsif p_status = 'encerrada' and v_antes.status = 'publicada' then
    update public.pesquisa
       set status = 'encerrada', encerrada_em = now(), atualizada_em = now()
     where id = p_id;
  else
    raise exception 'TRANSICAO_INVALIDA' using errcode = '22023';
  end if;

  perform public.write_platform_audit_log(
    case p_status when 'publicada' then 'survey_published' else 'survey_closed' end,
    'survey', p_id, jsonb_build_object('status', v_antes.status), jsonb_build_object('status', p_status), null);
end;
$function$;

-- Excluir só rascunho (nunca apaga respostas de quem já participou).
create or replace function public.admin_excluir_rascunho_pesquisa(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_titulo text;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  delete from public.pesquisa where id = p_id and status = 'rascunho' returning titulo into v_titulo;
  if v_titulo is null then
    raise exception 'SO_RASCUNHO_PODE_SER_EXCLUIDO' using errcode = '22023';
  end if;
  perform public.write_platform_audit_log('survey_deleted', 'survey', p_id, jsonb_build_object('titulo', v_titulo), null, null);
end;
$function$;

create or replace function public.admin_listar_pesquisas()
returns table(
  id uuid, titulo text, pergunta text, tipo text, opcoes jsonb, permite_comentario boolean,
  funcionalidade text, publico text[], status text, publicar_em timestamptz, encerrar_em timestamptz,
  criada_em timestamptz, publicada_em timestamptz, encerrada_em timestamptz,
  exibicoes bigint, respostas bigint, dispensas bigint, ultima_resposta timestamptz
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
    select p.id, p.titulo, p.pergunta, p.tipo, p.opcoes, p.permite_comentario, p.funcionalidade, p.publico,
           -- "publicada" com janela vencida já é encerrada na prática
           case when p.status = 'publicada' and p.encerrar_em is not null and p.encerrar_em <= now() then 'encerrada' else p.status end,
           p.publicar_em, p.encerrar_em, p.criada_em, p.publicada_em, coalesce(p.encerrada_em, case when p.status = 'publicada' and p.encerrar_em <= now() then p.encerrar_em end),
           count(pp.id), count(pp.respondida_em), count(pp.dispensada_em), max(pp.respondida_em)
      from public.pesquisa p
      left join public.pesquisa_participacao pp on pp.pesquisa_id = p.id
     group by p.id
     order by case p.status when 'publicada' then 0 when 'rascunho' then 1 else 2 end, p.criada_em desc;
end;
$function$;

-- Resultado de uma pesquisa: distribuição por resposta e por público, e os
-- comentários/textos (com público, empresa e data — nunca quem respondeu).
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
    'exibicoes', (select count(*) from r),
    'respostas', (select count(*) from respondidas),
    'dispensas', (select count(*) from r where dispensada_em is not null),
    'empresas', (select count(distinct company_id) from respondidas),
    'media', case when v_tipo = 'nota' then (select round(avg((valor #>> '{}')::numeric), 2) from respondidas) end,
    'por_publico', coalesce((
      select jsonb_object_agg(publico, jsonb_build_object('exibicoes', total, 'respostas', resp))
        from (select publico, count(*) total, count(respondida_em) resp from r group by publico) x
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

revoke all on function public.admin_salvar_pesquisa(uuid, text, text, text, jsonb, boolean, text, text[], timestamptz, timestamptz) from public, anon;
revoke all on function public.admin_mudar_status_pesquisa(uuid, text) from public, anon;
revoke all on function public.admin_excluir_rascunho_pesquisa(uuid) from public, anon;
revoke all on function public.admin_listar_pesquisas() from public, anon;
revoke all on function public.admin_resultado_pesquisa(uuid) from public, anon;
grant execute on function public.admin_salvar_pesquisa(uuid, text, text, text, jsonb, boolean, text, text[], timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_mudar_status_pesquisa(uuid, text) to authenticated;
grant execute on function public.admin_excluir_rascunho_pesquisa(uuid) to authenticated;
grant execute on function public.admin_listar_pesquisas() to authenticated;
grant execute on function public.admin_resultado_pesquisa(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Beta: uma linha por empresa, com o que diz se ela está usando de verdade
-- ---------------------------------------------------------------------------
-- Estado (derivado, nunca escrito à mão):
--   suspensa     — empresa suspensa pela plataforma
--   configurando — onboarding não concluído
--   sem_uso      — concluiu o onboarding e nunca registrou operação
--   parada       — última operação há mais de 14 dias
--   esfriando    — última operação entre 7 e 14 dias
--   ativa        — operou nos últimos 7 dias
create or replace function public.admin_beta_empresas(p_days int default 30)
returns table(
  id uuid, name text, slug text, status text, onboarding_completed boolean,
  entrou_em timestamptz, origem text, beta_status text, beta_expira_em timestamptz,
  ultimo_acesso timestamptz, dias_sem_acesso int,
  ultima_atividade timestamptz, dias_sem_atividade int,
  modulos_usados int, agendamentos_periodo bigint, atendimentos_periodo bigint,
  pesquisas_respondidas bigint, comentarios bigint, ultima_resposta timestamptz,
  usuarios bigint, estado text
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
    with atividade as (
      select * from public.admin_company_activity(p_days)
    ),
    convite as (
      select distinct on (b.provisioned_company_id)
             b.provisioned_company_id as company_id, b.approved_at, b.status, b.beta_expires_at
        from public.beta_access_requests b
       where b.provisioned_company_id is not null
       order by b.provisioned_company_id, b.approved_at desc nulls last
    ),
    acesso as (
      select ucr.company_id, max(u.last_sign_in_at) as ultimo
        from public.user_company_role ucr
        join auth.users u on u.id = ucr.user_id
       group by ucr.company_id
    ),
    respostas as (
      select pp.company_id, count(*) as total, count(pp.comentario) + count(*) filter (where p.tipo = 'texto') as coment,
             max(pp.respondida_em) as ultima
        from public.pesquisa_participacao pp
        join public.pesquisa p on p.id = pp.pesquisa_id
       where pp.respondida_em is not null and pp.publico in ('gestor', 'profissional')
       group by pp.company_id
    )
    select
      a.id, a.name, a.slug, a.status, a.onboarding_completed,
      coalesce(cv.approved_at, a.created_at),
      case when cv.company_id is not null then 'convite_beta' else 'cadastro_direto' end,
      cv.status, cv.beta_expires_at,
      ac.ultimo,
      case when ac.ultimo is null then null else (extract(epoch from now() - ac.ultimo) / 86400)::int end,
      a.ultima_atividade,
      case when a.ultima_atividade is null then null else (extract(epoch from now() - a.ultima_atividade) / 86400)::int end,
      a.modulos_usados, a.agendamentos_periodo, a.atendimentos_periodo,
      coalesce(rs.total, 0), coalesce(rs.coment, 0), rs.ultima,
      a.usuarios,
      case
        when a.status = 'suspended' then 'suspensa'
        when not a.onboarding_completed then 'configurando'
        when a.ultima_atividade is null then 'sem_uso'
        when a.ultima_atividade < now() - interval '14 days' then 'parada'
        when a.ultima_atividade < now() - interval '7 days' then 'esfriando'
        else 'ativa'
      end
    from atividade a
    left join convite cv on cv.company_id = a.id
    left join acesso ac on ac.company_id = a.id
    left join respostas rs on rs.company_id = a.id
    order by coalesce(cv.approved_at, a.created_at) desc;
end;
$function$;

revoke all on function public.admin_beta_empresas(int) from public, anon;
grant execute on function public.admin_beta_empresas(int) to authenticated;
