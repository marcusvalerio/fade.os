-- Notificações em tempo real + diagnóstico completo em Admin → Saúde.
--
-- 1. `notificacao` entra na publicação `supabase_realtime`. O Realtime do
--    Supabase aplica a RLS de cada assinante a cada evento: a política
--    `notificacao_propria` já limita cada pessoa às próprias linhas e as de
--    público `plataforma` a quem tem sessão do Admin válida
--    (admin_sessao_valida). Nenhuma outra tabela entra.
-- 2. `admin_saude_notificacoes()` ganha o que faltava para responder "está
--    funcionando?" sem mostrar segredo: Realtime ligado, último envio de push,
--    última falha e o push de quem está olhando. Os nomes do Vault continuam
--    só como "configurado sim/não".

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notificacao'
  ) then
    alter publication supabase_realtime add table public.notificacao;
  end if;
end $$;

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
  if not public.admin_sessao_valida() then
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
    'vault_url', exists (select 1 from vault.secrets s where s.name = 'notificacoes_url'),
    'vault_segredo', exists (select 1 from vault.secrets s where s.name = 'notificacoes_segredo'),
    'realtime_notificacao', exists (
      select 1 from pg_publication_tables p
       where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = 'notificacao'),
    'ultimo_envio_push', (
      select max(e.enviada_em) from public.notificacao_entrega e where e.canal = 'push' and e.status = 'enviada'),
    'ultima_falha_push', (
      select jsonb_build_object('em', e.atualizada_em, 'status', e.status, 'erro', left(e.erro, 160))
        from public.notificacao_entrega e
       where e.canal = 'push' and e.status in ('falhou', 'token_invalido', 'sem_dispositivo')
       order by e.atualizada_em desc nulls last limit 1),
    'meu_push', jsonb_build_object(
      'ativo', coalesce((select a.push_ativo from public.notificacao_ajuste a where a.user_id = auth.uid()), false),
      'aparelhos', (select count(*) from public.notificacao_dispositivo d where d.user_id = auth.uid() and d.invalido_em is null),
      'ultimo_envio', (select max(d.ultimo_envio_em) from public.notificacao_dispositivo d where d.user_id = auth.uid())),
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
