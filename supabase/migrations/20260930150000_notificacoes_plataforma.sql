-- Notificações do CORTEX — público "plataforma" (o Admin do CORTEX).
--
-- Regra de produto:
--   notificação = ação necessária · dashboard = informação necessária ·
--   dados internos = observabilidade.
--
-- O Admin passa a ser um público do mesmo motor (notificar → notificacao →
-- entrega in_app + push por aparelho). Nada de tabela paralela: muda o
-- CHECK dos públicos, o RBAC (plataforma = platform_admin ativo) e as
-- funções da central ganham a área 'plataforma'.
--
-- Só vira notificação o que pede uma ação do Admin:
--   * nova solicitação de acesso ao Beta (uma por pedido);
--   * pedido de Beta esperando mais de 48 h (uma vez por pedido);
--   * incidente crítico (Sentry, via /api/plataforma/sentry);
--   * falha generalizada do push; falha de integração com impacto;
--   * incidente de segurança (mudança em quem administra a plataforma).
-- Inatividade de barbearia, métricas e atividade de rotina ficam no
-- dashboard — nunca em push.

-- ---------------------------------------------------------------------------
-- 1. Público e categoria novos
-- ---------------------------------------------------------------------------
alter table public.notificacao_tipo drop constraint notificacao_tipo_publicos_check;
alter table public.notificacao_tipo add constraint notificacao_tipo_publicos_check
  check (cardinality(publicos) > 0 and publicos <@ array['gestor', 'profissional', 'cliente', 'plataforma']::text[]);
-- um tipo da plataforma nunca é também de barbearia (e vice-versa)
alter table public.notificacao_tipo add constraint notificacao_tipo_plataforma_isolada
  check (not ('plataforma' = any (publicos)) or publicos = array['plataforma']::text[]);

alter table public.notificacao_tipo drop constraint notificacao_tipo_categoria_check;
alter table public.notificacao_tipo add constraint notificacao_tipo_categoria_check
  check (categoria in ('agenda', 'clientes', 'financeiro', 'estoque', 'equipe', 'sistema', 'produto', 'plataforma'));

alter table public.notificacao drop constraint notificacao_publico_check;
alter table public.notificacao add constraint notificacao_publico_check
  check (publico in ('gestor', 'profissional', 'cliente', 'plataforma'));

insert into public.notificacao_tipo (chave, categoria, preferencia, prioridade, obrigatoria, padrao_ligada, publicos, push, comunicavel, descricao) values
  ('plataforma.beta_solicitacao', 'plataforma', 'plataforma.beta',           'important', false, true, '{plataforma}', true, false, 'Nova solicitação de acesso ao Beta'),
  ('plataforma.beta_aguardando',  'plataforma', 'plataforma.beta',           'important', false, true, '{plataforma}', true, false, 'Solicitação de Beta aguardando análise'),
  ('plataforma.incidente',        'plataforma', 'plataforma.incidentes',     'critical',  true,  true, '{plataforma}', true, false, 'Incidente crítico da plataforma'),
  ('plataforma.push_falha',       'plataforma', 'plataforma.infraestrutura', 'important', true,  true, '{plataforma}', true, false, 'Falha generalizada no envio de notificações'),
  ('plataforma.integracao_falha', 'plataforma', 'plataforma.infraestrutura', 'important', true,  true, '{plataforma}', true, false, 'Falha de integração'),
  ('plataforma.seguranca',        'plataforma', 'plataforma.seguranca',      'critical',  true,  true, '{plataforma}', true, false, 'Mudança em quem administra a plataforma');

-- ---------------------------------------------------------------------------
-- 2. RBAC: plataforma = platform_admin ativo (e só isso)
-- ---------------------------------------------------------------------------
create or replace function public.notificacao_tem_publico(p_user uuid, p_company uuid, p_publico text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select case p_publico
    when 'plataforma' then public.is_platform_admin(p_user)
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
    union
    select 'plataforma' where public.is_platform_admin(p_user)
  ) x;
$function$;

-- notificar(): o público plataforma é conferido mesmo sem empresa (as
-- notificações da plataforma não pertencem a barbearia nenhuma).
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

  -- RBAC real: com empresa, a pessoa precisa ter aquele público nela; a
  -- plataforma exige platform_admin ativo sempre.
  if p_publico = 'plataforma' then
    if not public.is_platform_admin(p_user) then
      return null;
    end if;
  elsif p_company is not null and not public.notificacao_tem_publico(p_user, p_company, p_publico) then
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
  values (p_user, case when p_publico = 'plataforma' then null else p_company end, p_publico, p_tipo, v_tipo.categoria, coalesce(p_prioridade, v_tipo.prioridade),
          left(btrim(p_titulo), 120), left(btrim(p_corpo), 400), p_url, coalesce(p_dados, '{}'::jsonb), p_chave, p_comunicado, p_pesquisa)
  on conflict (chave_unica) do nothing
  returning id into v_id;

  if v_id is null then
    return null;
  end if;

  insert into public.notificacao_entrega (notificacao_id, canal, status) values (v_id, 'in_app', 'entregue');

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

-- Atalho: todos os platform_admin ativos. A chave vira chave:usuario (a
-- mesma regra dos outros atalhos), então o mesmo evento nunca chega duas
-- vezes para a mesma pessoa. Incidentes têm teto de 5 por hora por pessoa:
-- uma tempestade de erros não vira uma tempestade de push.
create or replace function public.notificar_plataforma(
  p_tipo text, p_titulo text, p_corpo text, p_url text, p_dados jsonb, p_chave text,
  p_prioridade text default null, p_excluir uuid[] default null
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
  if p_chave is null or p_tipo not like 'plataforma.%' then
    raise exception 'NOTIFICACAO_DA_PLATAFORMA_INVALIDA' using errcode = '22023';
  end if;
  for v_user in select pa.user_id from public.platform_admin pa where pa.status = 'active' loop
    continue when v_user = any (coalesce(p_excluir, '{}'::uuid[]));
    if p_tipo = 'plataforma.incidente' and (
      select count(*) from public.notificacao n
       where n.user_id = v_user and n.tipo = 'plataforma.incidente' and n.criada_em > now() - interval '1 hour') >= 5 then
      continue;
    end if;
    if public.notificar(p_tipo, v_user, null, 'plataforma', p_titulo, p_corpo, p_url, p_dados, p_chave || ':' || v_user, p_prioridade) is not null then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$function$;

revoke all on function public.notificar_plataforma(text, text, text, text, jsonb, text, text, uuid[]) from public, anon, authenticated;
grant execute on function public.notificar_plataforma(text, text, text, text, jsonb, text, text, uuid[]) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Leitura: a área 'plataforma' só existe para platform_admin ativo
-- ---------------------------------------------------------------------------
drop policy notificacao_propria on public.notificacao;
create policy notificacao_propria on public.notificacao for select to authenticated
  using (user_id = auth.uid() and (publico <> 'plataforma' or public.is_platform_admin(auth.uid())));

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
     and (case p_area
            when 'cliente' then n.publico = 'cliente' and (n.company_id is null or n.company_id = p_company)
            when 'plataforma' then n.publico = 'plataforma' and public.is_platform_admin(auth.uid())
            else n.publico in ('gestor', 'profissional') and (n.company_id is null or n.company_id = p_company)
          end)
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
     and (case p_area
            when 'cliente' then n.publico = 'cliente' and (n.company_id is null or n.company_id = p_company)
            when 'plataforma' then n.publico = 'plataforma' and public.is_platform_admin(auth.uid())
            else n.publico in ('gestor', 'profissional') and (n.company_id is null or n.company_id = p_company)
          end);
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
     and (case p_area
            when 'cliente' then n.publico = 'cliente' and (n.company_id is null or n.company_id = p_company)
            when 'plataforma' then n.publico = 'plataforma' and public.is_platform_admin(auth.uid())
            else n.publico in ('gestor', 'profissional') and (n.company_id is null or n.company_id = p_company)
          end);
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

create or replace function public.marcar_notificacao_lida(p_id uuid)
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  update public.notificacao set lida_em = coalesce(lida_em, now())
   where id = p_id and user_id = auth.uid() and (publico <> 'plataforma' or public.is_platform_admin(auth.uid()));
$function$;

create or replace function public.arquivar_notificacao(p_id uuid)
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  update public.notificacao set arquivada_em = coalesce(arquivada_em, now()), lida_em = coalesce(lida_em, now())
   where id = p_id and user_id = auth.uid() and (publico <> 'plataforma' or public.is_platform_admin(auth.uid()));
$function$;

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
   where id = p_id and user_id = auth.uid() and (publico <> 'plataforma' or public.is_platform_admin(auth.uid()))
  returning url into v_url;
  if not found then
    raise exception 'NOTIFICACAO_NAO_ENCONTRADA' using errcode = '42501';
  end if;
  return v_url;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Beta: nova solicitação (uma por pedido) e fim da pendência
-- ---------------------------------------------------------------------------
-- O corpo leva só o necessário para decidir abrir: barbearia e região.
-- E-mail, nome e telefone ficam na tela de acessos, atrás do RBAC.
create or replace function public.notificar_beta_solicitacao()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_quem text := concat_ws(' · ', nullif(btrim(new.barbershop_name), ''), nullif(btrim(new.region), ''));
begin
  if new.status = 'pending' then
    perform public.notificar_plataforma(
      'plataforma.beta_solicitacao',
      'Nova solicitação de acesso ao Beta',
      case when v_quem = '' then 'Uma barbearia pediu acesso ao Beta.' else v_quem || ' pediu acesso ao Beta.' end,
      '/admin/acessos',
      jsonb_build_object('solicitacao', new.id),
      'beta.solicitacao:' || new.id
    );
  end if;
  return null;
exception when others then
  -- notificar nunca pode impedir o pedido de entrar
  raise warning 'notificar solicitação de beta falhou: %', sqlerrm;
  return null;
end;
$function$;

-- Pedido decidido (aprovado, recusado, revogado): as notificações dele
-- deixam de pedir ação — para todos os admins, não só quem decidiu.
create or replace function public.resolver_notificacoes_beta()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  update public.notificacao n set lida_em = coalesce(n.lida_em, now())
   where n.publico = 'plataforma'
     and n.tipo in ('plataforma.beta_solicitacao', 'plataforma.beta_aguardando')
     and n.dados ->> 'solicitacao' = new.id::text
     and n.lida_em is null;
  return null;
exception when others then
  raise warning 'resolver notificações de beta falhou: %', sqlerrm;
  return null;
end;
$function$;

revoke all on function public.notificar_beta_solicitacao() from public, anon, authenticated;
revoke all on function public.resolver_notificacoes_beta() from public, anon, authenticated;

create trigger notificar_beta_solicitacao
  after insert on public.beta_access_requests
  for each row execute function public.notificar_beta_solicitacao();

create trigger resolver_notificacoes_beta
  after update of status on public.beta_access_requests
  for each row when (old.status = 'pending' and new.status is distinct from 'pending')
  execute function public.resolver_notificacoes_beta();

-- ---------------------------------------------------------------------------
-- 5. Segurança: mudança em quem administra a plataforma
-- ---------------------------------------------------------------------------
-- Vai para os OUTROS admins ativos (nem quem fez, nem quem mudou): é o
-- sinal que permite perceber um acesso administrativo inesperado.
create or replace function public.notificar_mudanca_de_admin()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_email text;
  v_ativou boolean := new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active');
  v_saiu boolean := tg_op = 'UPDATE' and old.status = 'active' and new.status is distinct from 'active';
begin
  if not (v_ativou or v_saiu) then
    return null;
  end if;
  select u.email into v_email from auth.users u where u.id = new.user_id;
  perform public.notificar_plataforma(
    'plataforma.seguranca',
    case when v_ativou then 'Novo administrador da plataforma' else 'Administrador da plataforma removido' end,
    coalesce(v_email, 'Uma conta') || case when v_ativou then ' agora tem acesso total ao Admin.' else ' perdeu o acesso ao Admin.' end
      || ' Se não foi combinado, revise a auditoria.',
    '/admin/auditoria',
    jsonb_build_object('admin', new.user_id, 'status', new.status),
    'seguranca.admin:' || new.user_id || ':' || new.status || ':' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS'),
    null,
    array_remove(array[auth.uid(), new.user_id], null)
  );
  return null;
exception when others then
  raise warning 'notificar mudança de admin falhou: %', sqlerrm;
  return null;
end;
$function$;

revoke all on function public.notificar_mudanca_de_admin() from public, anon, authenticated;

create trigger notificar_mudanca_de_admin
  after insert or update of status on public.platform_admin
  for each row execute function public.notificar_mudanca_de_admin();

-- ---------------------------------------------------------------------------
-- 6. Verificações periódicas (pg_cron, a cada 15 min)
-- ---------------------------------------------------------------------------
-- Cada regra cria a notificação uma vez só (chave por pedido ou por dia);
-- nada se repete a cada rodada. Limites:
--   * Beta pendente há mais de 48 h;
--   * push: ≥ 10 falhas na última hora e ≥ metade das tentativas, ou
--     ≥ 10 entregas presas há mais de 30 min para ≥ 3 pessoas;
--   * despertar do envio (pg_net → servidor): ≥ 5 respostas de erro na hora;
--   * jobs do pg_cron de notificações/plataforma: ≥ 3 falhas na hora.
create or replace function public.verificar_plataforma()
returns int
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_dia text := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD');
  v_n int := 0;
  v_r record;
  v_falhas int;
  v_total int;
  v_presas int;
  v_pessoas int;
  v_erros int;
begin
  -- (a) Beta esperando análise
  begin
    for v_r in
      select b.id, b.barbershop_name, b.region, b.created_at
        from public.beta_access_requests b
       where b.status = 'pending'
         and b.created_at < now() - interval '48 hours'
         and b.created_at > now() - interval '60 days'
    loop
      v_n := v_n + public.notificar_plataforma(
        'plataforma.beta_aguardando',
        'Solicitação de Beta aguardando há ' || floor(extract(epoch from now() - v_r.created_at) / 86400)::int || ' dias',
        coalesce(nullif(btrim(v_r.barbershop_name), ''), 'Uma barbearia')
          || coalesce(' · ' || nullif(btrim(v_r.region), ''), '') || ' ainda espera aprovação.',
        '/admin/acessos',
        jsonb_build_object('solicitacao', v_r.id),
        'beta.aguardando:' || v_r.id
      );
    end loop;
  exception when others then
    raise warning 'verificar beta falhou: %', sqlerrm;
  end;

  -- (b) Push
  begin
    select count(*) filter (where e.status = 'falhou'), count(*) filter (where e.status in ('enviada', 'falhou'))
      into v_falhas, v_total
      from public.notificacao_entrega e
     where e.canal = 'push' and e.atualizada_em > now() - interval '1 hour';
    if v_falhas >= 10 and v_falhas * 2 >= v_total then
      v_n := v_n + public.notificar_plataforma(
        'plataforma.push_falha',
        'Envio de push falhando',
        v_falhas || ' de ' || v_total || ' envios falharam na última hora. Confira a configuração do Firebase no servidor.',
        '/admin/sistema#notificacoes',
        jsonb_build_object('falhas', v_falhas, 'tentativas', v_total),
        'push.falha:' || v_dia
      );
    end if;

    select count(*), count(distinct n.user_id) into v_presas, v_pessoas
      from public.notificacao_entrega e join public.notificacao n on n.id = e.notificacao_id
     where e.canal = 'push' and e.status in ('pendente', 'enviando')
       and e.criada_em < now() - interval '30 minutes' and e.criada_em > now() - interval '1 day';
    if v_presas >= 10 and v_pessoas >= 3 then
      v_n := v_n + public.notificar_plataforma(
        'plataforma.push_falha',
        'Push parado na fila',
        v_presas || ' notificações para ' || v_pessoas || ' pessoas esperam envio há mais de 30 minutos.',
        '/admin/sistema#notificacoes',
        jsonb_build_object('presas', v_presas, 'pessoas', v_pessoas),
        'push.presas:' || v_dia
      );
    end if;
  exception when others then
    raise warning 'verificar push falhou: %', sqlerrm;
  end;

  -- (c) Despertar do envio (pg_net → /api/notificacoes/processar)
  begin
    select count(*) into v_erros from net._http_response r
     where r.created > now() - interval '1 hour'
       and (r.status_code is null or r.status_code not between 200 and 299);
    if v_erros >= 5 then
      v_n := v_n + public.notificar_plataforma(
        'plataforma.integracao_falha',
        'Servidor de envio não responde ao banco',
        v_erros || ' chamadas do banco ao servidor de notificações falharam na última hora.',
        '/admin/sistema#integracoes',
        jsonb_build_object('integracao', 'despertar_envio', 'erros', v_erros),
        'integracao.despertar:' || v_dia
      );
    end if;
  exception when others then
    raise warning 'verificar despertar falhou: %', sqlerrm;
  end;

  -- (d) Jobs agendados
  begin
    for v_r in
      select j.jobname, count(*) as falhas
        from cron.job_run_details d join cron.job j on j.jobid = d.jobid
       where d.status = 'failed' and d.start_time > now() - interval '1 hour'
         and (j.jobname like 'notificacoes-%' or j.jobname like 'plataforma-%')
       group by j.jobname
      having count(*) >= 3
    loop
      v_n := v_n + public.notificar_plataforma(
        'plataforma.integracao_falha',
        'Processamento automático falhando',
        'O job ' || v_r.jobname || ' falhou ' || v_r.falhas || ' vezes na última hora.',
        '/admin/sistema#jobs',
        jsonb_build_object('integracao', 'pg_cron', 'job', v_r.jobname, 'falhas', v_r.falhas),
        'integracao.job:' || v_r.jobname || ':' || v_dia
      );
    end loop;
  exception when others then
    raise warning 'verificar jobs falhou: %', sqlerrm;
  end;

  return v_n;
end;
$function$;

revoke all on function public.verificar_plataforma() from public, anon, authenticated;

select cron.schedule('plataforma-verificacoes', '*/15 * * * *', $$select public.verificar_plataforma()$$);

-- ---------------------------------------------------------------------------
-- 7. Leituras do Admin (dashboard — informação, não notificação)
-- ---------------------------------------------------------------------------
-- Estado das notificações/push, do despertar e dos jobs.
create or replace function public.admin_saude_notificacoes()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v jsonb;
  v_despertar jsonb := jsonb_build_object('chamadas_1h', null, 'erros_1h', null);
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  begin
    select jsonb_build_object(
             'chamadas_1h', count(*),
             'erros_1h', count(*) filter (where r.status_code is null or r.status_code not between 200 and 299))
      into v_despertar
      from net._http_response r where r.created > now() - interval '1 hour';
  exception when others then
    null;
  end;

  select jsonb_build_object(
    'criadas_24h', (select count(*) from public.notificacao n where n.criada_em > now() - interval '24 hours' and n.publico <> 'plataforma'),
    'abertas_24h', (select count(*) from public.notificacao n where n.criada_em > now() - interval '24 hours' and n.publico <> 'plataforma' and n.aberta_em is not null),
    'push_24h', coalesce((
      select jsonb_object_agg(status, total) from (
        select e.status, count(*) as total from public.notificacao_entrega e
         where e.canal = 'push' and e.criada_em > now() - interval '24 hours' group by e.status) x), '{}'::jsonb),
    'push_presas', (
      select count(*) from public.notificacao_entrega e
       where e.canal = 'push' and e.status in ('pendente', 'enviando')
         and e.criada_em < now() - interval '30 minutes' and e.criada_em > now() - interval '1 day'),
    'aparelhos_ativos', (select count(*) from public.notificacao_dispositivo d where d.invalido_em is null),
    'pessoas_com_push', (select count(*) from public.notificacao_ajuste a where a.push_ativo),
    'despertar_configurado', (
      select count(distinct s.name) = 2 from vault.secrets s where s.name in ('notificacoes_url', 'notificacoes_segredo')),
    'despertar', v_despertar,
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nome', j.jobname, 'agenda', j.schedule, 'ativo', j.active,
               'ultima_execucao', u.start_time, 'ultimo_status', u.status,
               'duracao_ms', (extract(epoch from u.end_time - u.start_time) * 1000)::int,
               'falhas_24h', coalesce(f.falhas, 0), 'execucoes_24h', coalesce(f.total, 0))
             order by j.jobname)
        from cron.job j
        left join lateral (
          select d.status, d.start_time, d.end_time from cron.job_run_details d
           where d.jobid = j.jobid order by d.start_time desc limit 1) u on true
        left join lateral (
          select count(*) filter (where d.status = 'failed') as falhas, count(*) as total from cron.job_run_details d
           where d.jobid = j.jobid and d.start_time > now() - interval '24 hours') f on true
       where j.jobname like 'notificacoes-%' or j.jobname like 'plataforma-%'), '[]'::jsonb),
    -- o que a plataforma avisou ao Admin (um evento conta uma vez, não por admin)
    'avisos_7d', coalesce((
      select jsonb_object_agg(tipo, total) from (
        select n.tipo, count(distinct regexp_replace(n.chave_unica, ':[0-9a-f-]{36}$', '')) as total
          from public.notificacao n
         where n.publico = 'plataforma' and n.criada_em > now() - interval '7 days'
         group by n.tipo) x), '{}'::jsonb)
  ) into v;
  return v;
end;
$function$;

-- Funil do Beta: pedido → aprovação (daqui); utilização/abandono vêm de
-- admin_beta_empresas; feedback e pesquisas, daqui.
create or replace function public.admin_beta_funil()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v jsonb;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  with neg as (
    -- resposta que indica dificuldade: nota 1–2 ou "não"
    select pp.*, p.titulo, p.funcionalidade, p.tipo,
           case
             when p.tipo = 'nota' and jsonb_typeof(pp.valor) = 'number' then (pp.valor #>> '{}')::numeric <= 2
             when p.tipo = 'sim_nao' and jsonb_typeof(pp.valor) = 'boolean' then not (pp.valor #>> '{}')::boolean
             else false
           end as negativa
      from public.pesquisa_participacao pp join public.pesquisa p on p.id = pp.pesquisa_id
     where pp.respondida_em is not null
  )
  select jsonb_build_object(
    'solicitacoes', coalesce((select jsonb_object_agg(status, total) from (
        select b.status, count(*) as total from public.beta_access_requests b group by b.status) x), '{}'::jsonb),
    'recebidas_30d', (select count(*) from public.beta_access_requests b where b.created_at > now() - interval '30 days'),
    'aguardando_48h', (select count(*) from public.beta_access_requests b where b.status = 'pending' and b.created_at < now() - interval '48 hours'),
    'pendente_mais_antiga', (select min(b.created_at) from public.beta_access_requests b where b.status = 'pending'),
    'horas_ate_aprovar', (
      select round((percentile_cont(0.5) within group (order by (extract(epoch from b.approved_at - b.created_at) / 3600)::float8))::numeric, 1)
        from public.beta_access_requests b where b.approved_at is not null and b.created_at > now() - interval '180 days'),
    'funcionalidades', coalesce((
      select jsonb_agg(jsonb_build_object('funcionalidade', f, 'respostas', total, 'negativas', negativas, 'media', media) order by total desc)
        from (
          select coalesce(nullif(btrim(neg.funcionalidade), ''), 'Geral') as f, count(*) as total,
                 count(*) filter (where neg.negativa) as negativas,
                 round(avg((neg.valor #>> '{}')::numeric) filter (where neg.tipo = 'nota' and jsonb_typeof(neg.valor) = 'number'), 2) as media
            from neg group by 1) x), '[]'::jsonb),
    'dificuldades', coalesce((
      select jsonb_agg(d order by (d ->> 'em') desc) from (
        select jsonb_build_object(
                 'pesquisa', neg.titulo, 'pesquisa_id', neg.pesquisa_id, 'funcionalidade', neg.funcionalidade,
                 'texto', coalesce(case when neg.tipo = 'texto' then neg.valor #>> '{}' end, neg.comentario),
                 'negativa', neg.negativa, 'publico', neg.publico, 'empresa', c.name, 'empresa_id', neg.company_id,
                 'em', neg.respondida_em) as d
          from neg left join public.company c on c.id = neg.company_id
         where neg.respondida_em > now() - interval '90 days'
           and (neg.negativa or neg.comentario is not null or neg.tipo = 'texto')
         order by neg.respondida_em desc
         limit 12) y), '[]'::jsonb)
  ) into v;
  return v;
end;
$function$;

-- Ficha da empresa: o que a Central de uma barbearia mostra ao investigar.
create or replace function public.admin_empresa_investigacao(p_company uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v jsonb;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'beta', (
      select jsonb_build_object('status', b.status, 'pedido_em', b.created_at, 'aprovado_em', b.approved_at,
                                'expira_em', b.beta_expires_at, 'regiao', b.region)
        from public.beta_access_requests b where b.provisioned_company_id = p_company
       order by b.created_at desc limit 1),
    'pesquisas', (
      select jsonb_build_object('exibidas', count(*), 'respondidas', count(pp.respondida_em), 'dispensadas', count(pp.dispensada_em))
        from public.pesquisa_participacao pp where pp.company_id = p_company),
    'comentarios', coalesce((
      select jsonb_agg(c order by (c ->> 'em') desc) from (
        select jsonb_build_object(
                 'pesquisa', p.titulo, 'pesquisa_id', p.id, 'tipo', p.tipo,
                 'texto', coalesce(case when p.tipo = 'texto' then pp.valor #>> '{}' end, pp.comentario),
                 'valor', case when p.tipo <> 'texto' then pp.valor end,
                 'publico', pp.publico, 'em', pp.respondida_em) as c
          from public.pesquisa_participacao pp join public.pesquisa p on p.id = pp.pesquisa_id
         where pp.company_id = p_company and pp.respondida_em is not null
         order by pp.respondida_em desc limit 8) x), '[]'::jsonb),
    'notificacoes_30d', coalesce((
      select jsonb_agg(jsonb_build_object('categoria', categoria, 'total', total, 'abertas', abertas) order by total desc) from (
        select n.categoria, count(*) as total, count(n.aberta_em) as abertas
          from public.notificacao n
         where n.company_id = p_company and n.criada_em > now() - interval '30 days'
         group by n.categoria) x), '[]'::jsonb),
    -- o que foi relevante (importante/crítico), agrupado por evento — sem
    -- dizer quem recebeu
    'historico', coalesce((
      select jsonb_agg(h order by (h ->> 'em') desc) from (
        select jsonb_build_object('tipo', n.tipo, 'titulo', n.titulo, 'prioridade', n.prioridade,
                                  'destinatarios', count(*), 'em', min(n.criada_em)) as h
          from public.notificacao n
         where n.company_id = p_company and n.prioridade in ('critical', 'important')
           and n.criada_em > now() - interval '90 days'
         group by n.tipo, n.titulo, n.prioridade, date_trunc('minute', n.criada_em)
         order by min(n.criada_em) desc limit 10) x), '[]'::jsonb),
    'push', (
      select jsonb_build_object(
               'pessoas', count(distinct ucr.user_id),
               'com_push', count(distinct ucr.user_id) filter (where a.push_ativo),
               'aparelhos', (select count(*) from public.notificacao_dispositivo d
                              where d.invalido_em is null
                                and d.user_id in (select u.user_id from public.user_company_role u where u.company_id = p_company)))
        from public.user_company_role ucr
        left join public.notificacao_ajuste a on a.user_id = ucr.user_id
       where ucr.company_id = p_company),
    -- avisos da plataforma ligados a esta empresa (ex.: incidente com a
    -- empresa na tag do Sentry); um evento conta uma vez
    'incidentes', coalesce((
      select jsonb_agg(i order by (i ->> 'em') desc) from (
        select distinct on (regexp_replace(n.chave_unica, ':[0-9a-f-]{36}$', ''))
               jsonb_build_object('tipo', n.tipo, 'titulo', n.titulo, 'corpo', n.corpo, 'url', n.url, 'em', n.criada_em) as i
          from public.notificacao n
         where n.publico = 'plataforma' and n.dados ->> 'empresa' = p_company::text
           and n.criada_em > now() - interval '90 days'
         order by regexp_replace(n.chave_unica, ':[0-9a-f-]{36}$', ''), n.criada_em) x), '[]'::jsonb)
  ) into v;
  return v;
end;
$function$;

revoke all on function public.admin_saude_notificacoes() from public, anon;
revoke all on function public.admin_beta_funil() from public, anon;
revoke all on function public.admin_empresa_investigacao(uuid) from public, anon;
grant execute on function public.admin_saude_notificacoes() to authenticated;
grant execute on function public.admin_beta_funil() to authenticated;
grant execute on function public.admin_empresa_investigacao(uuid) to authenticated;
