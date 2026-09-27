-- Notificações do CORTEX — base.
--
-- O Supabase é a fonte de verdade: a notificação existe aqui mesmo que o
-- push esteja bloqueado ou o aparelho offline. O Firebase Cloud Messaging é
-- só um canal de entrega (notificacao_entrega.canal = 'push').
--
--   evento → notificar(...) → confere público (RBAC real) e preferência
--          → notificacao (+ entrega in_app) → entrega push 'pendente' por
--            aparelho → worker no servidor envia pelo FCM → registra resultado
--
-- Ninguém escreve direto nas tabelas: RLS só libera leitura do que é da
-- própria pessoa; toda escrita passa por função que confere quem chama.

-- ---------------------------------------------------------------------------
-- 1. Catálogo de tipos (espelhado em lib/notificacoes/catalogo.ts)
-- ---------------------------------------------------------------------------
create table public.notificacao_tipo (
  chave text primary key,
  categoria text not null check (categoria in ('agenda', 'clientes', 'financeiro', 'estoque', 'equipe', 'sistema', 'produto')),
  -- linha de preferência que liga/desliga este tipo (vários tipos podem
  -- dividir a mesma linha: "Alterações de horário" cobre reagendado,
  -- confirmado e chegada)
  preferencia text not null,
  prioridade text not null check (prioridade in ('critical', 'important', 'normal', 'informational')),
  obrigatoria boolean not null default false,
  padrao_ligada boolean not null default true,
  publicos text[] not null check (cardinality(publicos) > 0 and publicos <@ array['gestor', 'profissional', 'cliente']::text[]),
  push boolean not null default true,
  -- só estes podem ser disparados pelo Admin como comunicado
  comunicavel boolean not null default false,
  descricao text not null
);

insert into public.notificacao_tipo (chave, categoria, preferencia, prioridade, obrigatoria, padrao_ligada, publicos, push, comunicavel, descricao) values
  ('agenda.novo',            'agenda',     'agenda.novos',         'normal',        false, true,  '{gestor,profissional}',         true,  false, 'Novo agendamento'),
  ('agenda.reagendado',      'agenda',     'agenda.alteracoes',    'normal',        false, true,  '{gestor,profissional,cliente}', true,  false, 'Horário mudou'),
  ('agenda.confirmado',      'agenda',     'agenda.alteracoes',    'informational', false, true,  '{cliente}',                     true,  false, 'Agendamento confirmado pela barbearia'),
  ('agenda.chegou',          'agenda',     'agenda.alteracoes',    'normal',        false, true,  '{profissional}',                true,  false, 'Cliente chegou'),
  ('agenda.cancelado',       'agenda',     'agenda.cancelamentos', 'important',     false, true,  '{gestor,profissional,cliente}', true,  false, 'Agendamento cancelado'),
  ('agenda.nao_compareceu',  'agenda',     'agenda.cancelamentos', 'informational', false, true,  '{gestor}',                      false, false, 'Cliente não compareceu'),
  ('agenda.lembrete',        'agenda',     'agenda.lembretes',     'normal',        false, true,  '{cliente}',                     true,  false, 'Lembrete do horário'),
  ('clientes.avaliacao',     'clientes',   'clientes.avaliacoes',  'normal',        false, true,  '{gestor,profissional}',         true,  false, 'Avaliação recebida'),
  ('clientes.importacao',    'clientes',   'clientes.importacoes', 'informational', false, true,  '{gestor}',                      false, false, 'Importação de clientes concluída'),
  ('financeiro.caixa_diferenca', 'financeiro', 'financeiro.alertas', 'important',  false, true,  '{gestor}',                      true,  false, 'Caixa fechado com diferença'),
  ('estoque.baixo',          'estoque',    'estoque.baixo',        'normal',        false, true,  '{gestor}',                      false, false, 'Estoque no mínimo'),
  ('estoque.sem_estoque',    'estoque',    'estoque.sem_estoque',  'important',     false, true,  '{gestor}',                      true,  false, 'Produto sem estoque'),
  ('equipe.comissao_paga',   'equipe',     'equipe.comissoes',     'normal',        false, true,  '{profissional}',                true,  false, 'Comissão paga'),
  ('equipe.acesso',          'equipe',     'equipe.acessos',       'informational', false, true,  '{gestor}',                      false, false, 'Acesso da equipe mudou'),
  ('sistema.seguranca',      'sistema',    'sistema.seguranca',    'important',     true,  true,  '{gestor,profissional,cliente}', true,  false, 'Mudança no seu acesso'),
  ('sistema.manutencao',     'sistema',    'sistema.manutencao',   'important',     true,  true,  '{gestor,profissional,cliente}', true,  true,  'Manutenção e avisos essenciais'),
  ('sistema.atualizacao',    'sistema',    'sistema.atualizacoes', 'informational', false, true,  '{gestor,profissional,cliente}', false, true,  'Atualização importante do CORTEX'),
  ('produto.pesquisa',       'produto',    'produto.pesquisas',    'informational', false, true,  '{gestor,profissional,cliente}', true,  false, 'Pesquisa de funcionalidade'),
  ('produto.novidade',       'produto',    'produto.novidades',    'informational', false, true,  '{gestor,profissional,cliente}', false, true,  'Novidade do CORTEX'),
  ('produto.beta',           'produto',    'produto.beta',         'informational', false, true,  '{gestor,profissional}',         true,  true,  'Convite para recurso beta');

-- ---------------------------------------------------------------------------
-- 2. Preferências e ajustes por pessoa
-- ---------------------------------------------------------------------------
create table public.notificacao_preferencia (
  user_id uuid not null references auth.users(id) on delete cascade,
  preferencia text not null,
  ativa boolean not null,
  atualizada_em timestamptz not null default now(),
  primary key (user_id, preferencia)
);

create table public.notificacao_ajuste (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_ativo boolean not null default false,
  -- último estado de permissão que o navegador informou
  push_permissao text check (push_permissao in ('default', 'granted', 'denied', 'unsupported')),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Aparelhos (vários por pessoa; um token é de um aparelho só)
-- ---------------------------------------------------------------------------
create table public.notificacao_dispositivo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique check (length(token) between 20 and 4096),
  rotulo text check (rotulo is null or length(rotulo) <= 80),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  ultimo_envio_em timestamptz,
  invalido_em timestamptz,
  motivo_invalido text
);
create index notificacao_dispositivo_ativo_idx on public.notificacao_dispositivo (user_id) where invalido_em is null;

-- ---------------------------------------------------------------------------
-- 4. Comunicados do Admin (usados pela base só como referência)
-- ---------------------------------------------------------------------------
create table public.notificacao_comunicado (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(btrim(titulo)) between 3 and 90),
  mensagem text not null check (length(btrim(mensagem)) between 3 and 300),
  tipo text not null references public.notificacao_tipo(chave),
  prioridade text not null check (prioridade in ('critical', 'important', 'normal', 'informational')),
  url text check (url is null or url ~ '^/[A-Za-z0-9]'),
  -- papéis de destino: owner, admin (gerência), staff (profissionais), cliente
  papeis text[] not null check (cardinality(papeis) > 0 and papeis <@ array['owner', 'admin', 'staff', 'cliente']::text[]),
  -- null = todas as barbearias
  empresas uuid[],
  pesquisa_id uuid references public.pesquisa(id) on delete restrict,
  enviar_em timestamptz,
  status text not null default 'rascunho' check (status in ('rascunho', 'agendado', 'enviando', 'enviado', 'cancelado')),
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz,
  destinatarios int not null default 0,
  limitados int not null default 0,
  ignorados int not null default 0
);
-- uma pesquisa só vira notificação uma vez (não é ferramenta de disparo repetido)
create unique index notificacao_comunicado_pesquisa_unica on public.notificacao_comunicado (pesquisa_id)
  where pesquisa_id is not null and status <> 'cancelado';

-- ---------------------------------------------------------------------------
-- 5. Notificação e entrega
-- ---------------------------------------------------------------------------
create table public.notificacao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.company(id) on delete cascade,
  publico text not null check (publico in ('gestor', 'profissional', 'cliente')),
  tipo text not null references public.notificacao_tipo(chave),
  categoria text not null,
  prioridade text not null check (prioridade in ('critical', 'important', 'normal', 'informational')),
  titulo text not null check (length(titulo) between 1 and 120),
  corpo text not null check (length(corpo) between 1 and 400),
  -- destino dentro do CORTEX; só caminho relativo (nunca link externo)
  url text check (url is null or url ~ '^/[A-Za-z0-9]'),
  dados jsonb not null default '{}'::jsonb,
  comunicado_id uuid references public.notificacao_comunicado(id) on delete set null,
  pesquisa_id uuid references public.pesquisa(id) on delete set null,
  -- evita a mesma notificação duas vezes (evento repetido, trigger refeito)
  chave_unica text unique,
  criada_em timestamptz not null default now(),
  lida_em timestamptz,
  aberta_em timestamptz,
  arquivada_em timestamptz
);
create index notificacao_caixa_idx on public.notificacao (user_id, criada_em desc) where arquivada_em is null;
create index notificacao_nao_lida_idx on public.notificacao (user_id) where lida_em is null and arquivada_em is null;
create index notificacao_comunicado_idx on public.notificacao (comunicado_id) where comunicado_id is not null;

create table public.notificacao_entrega (
  id uuid primary key default gen_random_uuid(),
  notificacao_id uuid not null references public.notificacao(id) on delete cascade,
  canal text not null check (canal in ('in_app', 'push', 'email')),
  dispositivo_id uuid references public.notificacao_dispositivo(id) on delete set null,
  status text not null check (status in ('entregue', 'pendente', 'enviando', 'enviada', 'falhou', 'token_invalido', 'sem_dispositivo')),
  tentativas int not null default 0,
  erro text check (erro is null or length(erro) <= 200),
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  enviada_em timestamptz
);
create index notificacao_entrega_fila_idx on public.notificacao_entrega (criada_em) where status in ('pendente', 'enviando');
create index notificacao_entrega_notificacao_idx on public.notificacao_entrega (notificacao_id);

-- ---------------------------------------------------------------------------
-- 6. RLS: leitura só do que é seu; escrita só por função
-- ---------------------------------------------------------------------------
alter table public.notificacao_tipo enable row level security;
alter table public.notificacao_preferencia enable row level security;
alter table public.notificacao_ajuste enable row level security;
alter table public.notificacao_dispositivo enable row level security;
alter table public.notificacao_comunicado enable row level security;
alter table public.notificacao enable row level security;
alter table public.notificacao_entrega enable row level security;

revoke all on public.notificacao_tipo, public.notificacao_preferencia, public.notificacao_ajuste,
  public.notificacao_dispositivo, public.notificacao_comunicado, public.notificacao, public.notificacao_entrega
  from anon, authenticated;

grant select on public.notificacao_tipo to authenticated;
create policy notificacao_tipo_leitura on public.notificacao_tipo for select to authenticated using (true);

grant select on public.notificacao to authenticated;
create policy notificacao_propria on public.notificacao for select to authenticated using (user_id = auth.uid());

grant select on public.notificacao_preferencia to authenticated;
create policy notificacao_preferencia_propria on public.notificacao_preferencia for select to authenticated using (user_id = auth.uid());

grant select on public.notificacao_ajuste to authenticated;
create policy notificacao_ajuste_proprio on public.notificacao_ajuste for select to authenticated using (user_id = auth.uid());

grant select (id, rotulo, criado_em, atualizado_em, invalido_em) on public.notificacao_dispositivo to authenticated;
create policy notificacao_dispositivo_proprio on public.notificacao_dispositivo for select to authenticated using (user_id = auth.uid());
-- notificacao_entrega e notificacao_comunicado: sem política (Admin lê por
-- função com is_platform_admin; o worker usa service role no servidor)

-- ---------------------------------------------------------------------------
-- 7. Público real de uma pessoa numa barbearia (RBAC do CORTEX)
-- ---------------------------------------------------------------------------
create or replace function public.notificacao_tem_publico(p_user uuid, p_company uuid, p_publico text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select case p_publico
    when 'gestor' then exists (
      select 1 from public.user_company_role ucr
        join public.role r on r.id = ucr.role_id
        join public.company c on c.id = ucr.company_id
       where ucr.user_id = p_user and ucr.company_id = p_company and r.key in ('owner', 'admin') and c.status = 'active')
    when 'profissional' then exists (
      select 1 from public.user_company_role ucr
        join public.role r on r.id = ucr.role_id
        join public.company c on c.id = ucr.company_id
       where ucr.user_id = p_user and ucr.company_id = p_company and c.status = 'active'
         and (r.key = 'staff' or exists (
           select 1 from public.professional pr where pr.user_id = p_user and pr.company_id = p_company and pr.active)))
    when 'cliente' then exists (
      select 1 from public.client_identity ci where ci.user_id = p_user and ci.company_id = p_company)
    else false
  end;
$function$;

-- Públicos que a pessoa tem em qualquer barbearia (para mostrar só as
-- preferências que fazem sentido para ela).
create or replace function public.notificacao_publicos_do_usuario(p_user uuid)
returns text[]
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(array_agg(distinct p), '{}'::text[]) from (
    select 'gestor' as p from public.user_company_role ucr join public.role r on r.id = ucr.role_id
     where ucr.user_id = p_user and r.key in ('owner', 'admin')
    union
    select 'profissional' from public.user_company_role ucr join public.role r on r.id = ucr.role_id
     where ucr.user_id = p_user and r.key = 'staff'
    union
    select 'profissional' from public.professional pr where pr.user_id = p_user and pr.active
    union
    select 'cliente' from public.client_identity ci where ci.user_id = p_user
  ) x;
$function$;

revoke all on function public.notificacao_tem_publico(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.notificacao_publicos_do_usuario(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. O ponto único de criação: notificar(...)
-- ---------------------------------------------------------------------------
-- Interna: só triggers, funções do banco e o servidor (service role) chamam.
-- Devolve o id criado, ou null quando não deve notificar (sem público real,
-- preferência desligada, já notificado com a mesma chave).
create or replace function public.notificar(
  p_tipo text,
  p_user uuid,
  p_company uuid,
  p_publico text,
  p_titulo text,
  p_corpo text,
  p_url text default null,
  p_dados jsonb default '{}'::jsonb,
  p_chave text default null,
  p_prioridade text default null,
  p_comunicado uuid default null,
  p_pesquisa uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_tipo public.notificacao_tipo%rowtype;
  v_ativa boolean;
  v_id uuid;
  v_push boolean;
  v_disp record;
  v_algum boolean := false;
begin
  if p_user is null then
    return null;
  end if;

  select * into v_tipo from public.notificacao_tipo where chave = p_tipo;
  if not found then
    raise exception 'TIPO_DE_NOTIFICACAO_INEXISTENTE' using errcode = '22023';
  end if;
  if not (p_publico = any (v_tipo.publicos)) then
    return null;
  end if;

  -- RBAC real: com empresa, a pessoa precisa ter aquele público nela.
  if p_company is not null and not public.notificacao_tem_publico(p_user, p_company, p_publico) then
    return null;
  end if;

  if not v_tipo.obrigatoria then
    select np.ativa into v_ativa from public.notificacao_preferencia np
     where np.user_id = p_user and np.preferencia = v_tipo.preferencia;
    if not coalesce(v_ativa, v_tipo.padrao_ligada) then
      return null;
    end if;
  end if;

  insert into public.notificacao (user_id, company_id, publico, tipo, categoria, prioridade, titulo, corpo, url, dados, chave_unica, comunicado_id, pesquisa_id)
  values (p_user, p_company, p_publico, p_tipo, v_tipo.categoria, coalesce(p_prioridade, v_tipo.prioridade),
          left(btrim(p_titulo), 120), left(btrim(p_corpo), 400), p_url, coalesce(p_dados, '{}'::jsonb), p_chave, p_comunicado, p_pesquisa)
  on conflict (chave_unica) do nothing
  returning id into v_id;

  if v_id is null then
    return null;
  end if;

  insert into public.notificacao_entrega (notificacao_id, canal, status) values (v_id, 'in_app', 'entregue');

  -- Push: o tipo permite (críticos e importantes sempre podem) e a pessoa
  -- ligou o push neste ou em outro aparelho.
  select na.push_ativo into v_push from public.notificacao_ajuste na where na.user_id = p_user;
  if coalesce(v_push, false) and (v_tipo.push or coalesce(p_prioridade, v_tipo.prioridade) in ('critical', 'important')) then
    for v_disp in select d.id from public.notificacao_dispositivo d where d.user_id = p_user and d.invalido_em is null loop
      insert into public.notificacao_entrega (notificacao_id, canal, dispositivo_id, status) values (v_id, 'push', v_disp.id, 'pendente');
      v_algum := true;
    end loop;
    if not v_algum then
      insert into public.notificacao_entrega (notificacao_id, canal, status, erro) values (v_id, 'push', 'sem_dispositivo', 'nenhum aparelho ativo');
    end if;
  end if;

  return v_id;
end;
$function$;

revoke all on function public.notificar(text, uuid, uuid, text, text, text, text, jsonb, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.notificar(text, uuid, uuid, text, text, text, text, jsonb, text, text, uuid, uuid) to service_role;

-- Atalhos de destino (usados pelos eventos)
create or replace function public.notificar_gestores(
  p_company uuid, p_tipo text, p_titulo text, p_corpo text, p_url text, p_dados jsonb, p_chave text, p_excluir uuid default null
)
returns int
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user uuid;
  v_n int := 0;
begin
  for v_user in
    select distinct ucr.user_id from public.user_company_role ucr join public.role r on r.id = ucr.role_id
     where ucr.company_id = p_company and r.key in ('owner', 'admin')
  loop
    continue when v_user = p_excluir;
    if public.notificar(p_tipo, v_user, p_company, 'gestor', p_titulo, p_corpo, p_url, p_dados, p_chave || ':' || v_user) is not null then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$function$;

create or replace function public.notificar_profissional(
  p_professional uuid, p_tipo text, p_titulo text, p_corpo text, p_url text, p_dados jsonb, p_chave text, p_excluir uuid default null
)
returns int
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user uuid;
  v_company uuid;
begin
  select pr.user_id, pr.company_id into v_user, v_company from public.professional pr where pr.id = p_professional and pr.active;
  if v_user is null or v_user = p_excluir then
    return 0;
  end if;
  return (public.notificar(p_tipo, v_user, v_company, 'profissional', p_titulo, p_corpo, p_url, p_dados, p_chave || ':' || v_user) is not null)::int;
end;
$function$;

create or replace function public.notificar_cliente(
  p_client uuid, p_tipo text, p_titulo text, p_corpo text, p_url text, p_dados jsonb, p_chave text, p_excluir uuid default null
)
returns int
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_ci record;
  v_n int := 0;
begin
  for v_ci in select ci.user_id, ci.company_id from public.client_identity ci where ci.client_id = p_client loop
    continue when v_ci.user_id = p_excluir;
    if public.notificar(p_tipo, v_ci.user_id, v_ci.company_id, 'cliente', p_titulo, p_corpo, p_url, p_dados, p_chave || ':' || v_ci.user_id) is not null then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$function$;

revoke all on function public.notificar_gestores(uuid, text, text, text, text, jsonb, text, uuid) from public, anon, authenticated;
revoke all on function public.notificar_profissional(uuid, text, text, text, text, jsonb, text, uuid) from public, anon, authenticated;
revoke all on function public.notificar_cliente(uuid, text, text, text, text, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.notificar_gestores(uuid, text, text, text, text, jsonb, text, uuid) to service_role;
grant execute on function public.notificar_profissional(uuid, text, text, text, text, jsonb, text, uuid) to service_role;
grant execute on function public.notificar_cliente(uuid, text, text, text, text, jsonb, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 9. Central de notificações (quem está logado)
-- ---------------------------------------------------------------------------
-- Área 'equipe': públicos gestor/profissional da empresa atual (ou sem
-- empresa — comunicados da plataforma). Área 'cliente': público cliente.
create or replace function public.minhas_notificacoes(
  p_area text, p_company uuid, p_somente_nao_lidas boolean default false, p_limite int default 30, p_antes timestamptz default null
)
returns table(
  id uuid, tipo text, categoria text, prioridade text, titulo text, corpo text, url text,
  criada_em timestamptz, lida_em timestamptz, pesquisa_id uuid
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select n.id, n.tipo, n.categoria, n.prioridade, n.titulo, n.corpo, n.url, n.criada_em, n.lida_em, n.pesquisa_id
    from public.notificacao n
   where n.user_id = auth.uid()
     and n.arquivada_em is null
     and (case when p_area = 'cliente' then n.publico = 'cliente' else n.publico in ('gestor', 'profissional') end)
     and (n.company_id is null or n.company_id = p_company)
     and (not p_somente_nao_lidas or n.lida_em is null)
     and (p_antes is null or n.criada_em < p_antes)
   order by n.criada_em desc
   limit least(greatest(coalesce(p_limite, 30), 1), 100);
$function$;

create or replace function public.contar_notificacoes_nao_lidas(p_area text, p_company uuid)
returns int
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select count(*)::int from public.notificacao n
   where n.user_id = auth.uid() and n.lida_em is null and n.arquivada_em is null
     and (case when p_area = 'cliente' then n.publico = 'cliente' else n.publico in ('gestor', 'profissional') end)
     and (n.company_id is null or n.company_id = p_company);
$function$;

create or replace function public.marcar_notificacao_lida(p_id uuid)
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  update public.notificacao set lida_em = coalesce(lida_em, now()) where id = p_id and user_id = auth.uid();
$function$;

create or replace function public.marcar_notificacoes_lidas(p_area text, p_company uuid)
returns int
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_n int;
begin
  update public.notificacao n set lida_em = now()
   where n.user_id = auth.uid() and n.lida_em is null and n.arquivada_em is null
     and (case when p_area = 'cliente' then n.publico = 'cliente' else n.publico in ('gestor', 'profissional') end)
     and (n.company_id is null or n.company_id = p_company);
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

create or replace function public.arquivar_notificacao(p_id uuid)
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  update public.notificacao set arquivada_em = coalesce(arquivada_em, now()), lida_em = coalesce(lida_em, now())
   where id = p_id and user_id = auth.uid();
$function$;

-- Clique na notificação (na central ou no push): marca aberta e lida e
-- devolve o destino. Só a dona abre; destino é sempre caminho interno.
create or replace function public.abrir_notificacao(p_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_url text;
begin
  update public.notificacao set aberta_em = coalesce(aberta_em, now()), lida_em = coalesce(lida_em, now())
   where id = p_id and user_id = auth.uid()
  returning url into v_url;
  if not found then
    raise exception 'NOTIFICACAO_NAO_ENCONTRADA' using errcode = '42501';
  end if;
  return v_url;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 10. Preferências e aparelhos (quem está logado)
-- ---------------------------------------------------------------------------
create or replace function public.minhas_preferencias_notificacao()
returns table(preferencia text, categoria text, obrigatoria boolean, ativa boolean, publicos text[])
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with meus as (select public.notificacao_publicos_do_usuario(auth.uid()) as p)
  select t.preferencia, min(t.categoria), bool_or(t.obrigatoria),
         coalesce((select np.ativa from public.notificacao_preferencia np where np.user_id = auth.uid() and np.preferencia = t.preferencia), bool_or(t.padrao_ligada)),
         (select array_agg(distinct x) from public.notificacao_tipo t2, unnest(t2.publicos) x where t2.preferencia = t.preferencia)
    from public.notificacao_tipo t, meus
   where t.publicos && meus.p
   group by t.preferencia;
$function$;

create or replace function public.definir_preferencia_notificacao(p_preferencia text, p_ativa boolean)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_obrigatoria boolean;
  v_aplicavel boolean;
begin
  if auth.uid() is null then
    raise exception 'NAO_AUTENTICADO' using errcode = '42501';
  end if;
  select bool_or(t.obrigatoria), bool_or(t.publicos && public.notificacao_publicos_do_usuario(auth.uid()))
    into v_obrigatoria, v_aplicavel
    from public.notificacao_tipo t where t.preferencia = p_preferencia;
  if v_obrigatoria is null or not v_aplicavel then
    raise exception 'PREFERENCIA_INDISPONIVEL' using errcode = '42501';
  end if;
  if v_obrigatoria and not p_ativa then
    raise exception 'PREFERENCIA_OBRIGATORIA' using errcode = '22023';
  end if;
  insert into public.notificacao_preferencia (user_id, preferencia, ativa) values (auth.uid(), p_preferencia, p_ativa)
  on conflict (user_id, preferencia) do update set ativa = excluded.ativa, atualizada_em = now();
end;
$function$;

create or replace function public.meu_ajuste_de_notificacao()
returns table(push_ativo boolean, push_permissao text, aparelhos int)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(na.push_ativo, false), na.push_permissao,
         (select count(*)::int from public.notificacao_dispositivo d where d.user_id = auth.uid() and d.invalido_em is null)
    from (select 1) um
    left join public.notificacao_ajuste na on na.user_id = auth.uid();
$function$;

-- Liga/desliga o push da pessoa e guarda o que o navegador informou.
create or replace function public.definir_push_notificacao(p_ativo boolean, p_permissao text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null then
    raise exception 'NAO_AUTENTICADO' using errcode = '42501';
  end if;
  if p_permissao is not null and p_permissao not in ('default', 'granted', 'denied', 'unsupported') then
    raise exception 'PERMISSAO_INVALIDA' using errcode = '22023';
  end if;
  insert into public.notificacao_ajuste (user_id, push_ativo, push_permissao) values (auth.uid(), p_ativo, p_permissao)
  on conflict (user_id) do update set push_ativo = excluded.push_ativo,
    push_permissao = coalesce(excluded.push_permissao, notificacao_ajuste.push_permissao), atualizado_em = now();
end;
$function$;

-- Registra (ou reatribui) o token deste aparelho. Um token é de um aparelho:
-- se outra pessoa entrar no mesmo navegador, o token passa a ser dela.
create or replace function public.registrar_dispositivo_push(p_token text, p_rotulo text default null)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_excedente uuid;
begin
  if auth.uid() is null then
    raise exception 'NAO_AUTENTICADO' using errcode = '42501';
  end if;
  if p_token is null or length(p_token) not between 20 and 4096 then
    raise exception 'TOKEN_INVALIDO' using errcode = '22023';
  end if;

  insert into public.notificacao_dispositivo (user_id, token, rotulo)
  values (auth.uid(), p_token, left(nullif(btrim(p_rotulo), ''), 80))
  on conflict (token) do update
    set user_id = auth.uid(), rotulo = coalesce(excluded.rotulo, notificacao_dispositivo.rotulo),
        atualizado_em = now(), invalido_em = null, motivo_invalido = null;

  perform public.definir_push_notificacao(true, 'granted');

  -- Limite de aparelhos ativos por pessoa: o mais antigo sai.
  for v_excedente in
    select d.id from public.notificacao_dispositivo d
     where d.user_id = auth.uid() and d.invalido_em is null
     order by d.atualizado_em desc offset 10
  loop
    update public.notificacao_dispositivo set invalido_em = now(), motivo_invalido = 'limite de aparelhos' where id = v_excedente;
  end loop;
end;
$function$;

create or replace function public.remover_dispositivo_push(p_token text)
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  delete from public.notificacao_dispositivo where token = p_token and user_id = auth.uid();
$function$;

revoke all on function public.minhas_notificacoes(text, uuid, boolean, int, timestamptz) from public, anon;
revoke all on function public.contar_notificacoes_nao_lidas(text, uuid) from public, anon;
revoke all on function public.marcar_notificacao_lida(uuid) from public, anon;
revoke all on function public.marcar_notificacoes_lidas(text, uuid) from public, anon;
revoke all on function public.arquivar_notificacao(uuid) from public, anon;
revoke all on function public.abrir_notificacao(uuid) from public, anon;
revoke all on function public.minhas_preferencias_notificacao() from public, anon;
revoke all on function public.definir_preferencia_notificacao(text, boolean) from public, anon;
revoke all on function public.meu_ajuste_de_notificacao() from public, anon;
revoke all on function public.definir_push_notificacao(boolean, text) from public, anon;
revoke all on function public.registrar_dispositivo_push(text, text) from public, anon;
revoke all on function public.remover_dispositivo_push(text) from public, anon;
grant execute on function public.minhas_notificacoes(text, uuid, boolean, int, timestamptz) to authenticated;
grant execute on function public.contar_notificacoes_nao_lidas(text, uuid) to authenticated;
grant execute on function public.marcar_notificacao_lida(uuid) to authenticated;
grant execute on function public.marcar_notificacoes_lidas(text, uuid) to authenticated;
grant execute on function public.arquivar_notificacao(uuid) to authenticated;
grant execute on function public.abrir_notificacao(uuid) to authenticated;
grant execute on function public.minhas_preferencias_notificacao() to authenticated;
grant execute on function public.definir_preferencia_notificacao(text, boolean) to authenticated;
grant execute on function public.meu_ajuste_de_notificacao() to authenticated;
grant execute on function public.definir_push_notificacao(boolean, text) to authenticated;
grant execute on function public.registrar_dispositivo_push(text, text) to authenticated;
grant execute on function public.remover_dispositivo_push(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Fila de push (só o servidor, com service role)
-- ---------------------------------------------------------------------------
-- Reserva entregas pendentes (e as presas em 'enviando' há mais de 5 min)
-- sem que dois workers peguem a mesma.
create or replace function public.reservar_entregas_push(p_limite int default 50)
returns table(
  entrega_id uuid, notificacao_id uuid, token text, titulo text, corpo text, url text,
  prioridade text, tipo text, categoria text, tentativas int
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  return query
  with alvo as (
    select e.id from public.notificacao_entrega e
     where e.canal = 'push'
       and (e.status = 'pendente' or (e.status = 'enviando' and e.atualizada_em < now() - interval '5 minutes'))
       and e.tentativas < 5
       and e.criada_em > now() - interval '1 day'
     order by e.criada_em
     limit least(greatest(coalesce(p_limite, 50), 1), 500)
     for update skip locked
  ),
  marcadas as (
    update public.notificacao_entrega e
       set status = 'enviando', tentativas = e.tentativas + 1, atualizada_em = now()
      from alvo where e.id = alvo.id
    returning e.id, e.notificacao_id, e.dispositivo_id, e.tentativas
  )
  select m.id, n.id, d.token, n.titulo, n.corpo, n.url, n.prioridade, n.tipo, n.categoria, m.tentativas
    from marcadas m
    join public.notificacao n on n.id = m.notificacao_id
    join public.notificacao_dispositivo d on d.id = m.dispositivo_id
   where d.invalido_em is null;
end;
$function$;

create or replace function public.registrar_entrega_push(p_entrega uuid, p_status text, p_erro text default null)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_disp uuid;
begin
  if p_status not in ('enviada', 'falhou', 'token_invalido', 'pendente') then
    raise exception 'STATUS_INVALIDO' using errcode = '22023';
  end if;
  update public.notificacao_entrega
     set status = p_status, erro = left(p_erro, 200), atualizada_em = now(),
         enviada_em = case when p_status = 'enviada' then now() else enviada_em end
   where id = p_entrega
  returning dispositivo_id into v_disp;

  if p_status = 'enviada' and v_disp is not null then
    update public.notificacao_dispositivo set ultimo_envio_em = now() where id = v_disp;
  elsif p_status = 'token_invalido' and v_disp is not null then
    update public.notificacao_dispositivo set invalido_em = now(), motivo_invalido = left(coalesce(p_erro, 'token recusado pelo FCM'), 200) where id = v_disp;
    -- outras entregas pendentes para o mesmo aparelho não vão chegar
    update public.notificacao_entrega set status = 'token_invalido', erro = 'aparelho invalidado', atualizada_em = now()
     where dispositivo_id = v_disp and status = 'pendente';
  end if;
end;
$function$;

revoke all on function public.reservar_entregas_push(int) from public, anon, authenticated;
revoke all on function public.registrar_entrega_push(uuid, text, text) from public, anon, authenticated;
grant execute on function public.reservar_entregas_push(int) to service_role;
grant execute on function public.registrar_entrega_push(uuid, text, text) to service_role;
