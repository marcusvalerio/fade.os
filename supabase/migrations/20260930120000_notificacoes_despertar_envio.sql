-- Notificações do CORTEX — acordar o envio de push.
--
-- O push sai pelo servidor Next (/api/notificacoes/processar), que tem a
-- conta de serviço do Firebase. Quem avisa o servidor que há entrega
-- pendente é o próprio banco:
--
--   * logo depois do commit que criou a entrega (pg_net é assíncrono: a
--     chamada só sai se a transação confirmar; um rollback não acorda nada);
--   * a cada minuto, pelo pg_cron, se ainda houver pendente (retentativas,
--     instabilidade da Vercel, deploy no meio).
--
-- Endereço e segredo ficam no Supabase Vault, nunca no código:
--   select vault.create_secret('https://<domínio de produção>', 'notificacoes_url');
--   select vault.create_secret('<mesmo valor de NOTIFICACOES_SEGREDO na Vercel>', 'notificacoes_segredo');
-- Sem eles, nada é chamado (as notificações continuam na central; o push
-- espera — e o sino também dispara o envio quando alguém está usando).

create extension if not exists pg_net;

create or replace function public.acordar_envio_push(p_motivo text default 'evento')
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_url text;
  v_segredo text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notificacoes_url' limit 1;
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'notificacoes_segredo' limit 1;
  if v_url is null or v_segredo is null or v_url !~ '^https://' then
    return false;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/notificacoes/processar',
    body := jsonb_build_object('motivo', p_motivo),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_segredo),
    timeout_milliseconds := 10000
  );
  return true;
exception when others then
  raise warning 'acordar envio de push falhou: %', sqlerrm;
  return false;
end;
$function$;

revoke all on function public.acordar_envio_push(text) from public, anon, authenticated;

-- Uma chamada por transação, não uma por entrega: um comunicado para 300
-- pessoas acorda o servidor uma vez.
create or replace function public.notificacao_entrega_acordar()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if coalesce(current_setting('cortex.push_acordado', true), '') = '1' then
    return null;
  end if;
  if exists (select 1 from novas where canal = 'push' and status = 'pendente') then
    perform set_config('cortex.push_acordado', '1', true);
    perform public.acordar_envio_push('evento');
  end if;
  return null;
end;
$function$;

revoke all on function public.notificacao_entrega_acordar() from public, anon, authenticated;

create trigger notificacao_entrega_acordar
  after insert on public.notificacao_entrega
  referencing new table as novas
  for each statement execute function public.notificacao_entrega_acordar();

select cron.schedule('notificacoes-envio-push', '* * * * *', $$
  select public.acordar_envio_push('cron')
   where exists (select 1 from public.notificacao_entrega
                  where canal = 'push' and status in ('pendente', 'enviando')
                    and criada_em > now() - interval '1 day' and tentativas < 5)
$$);
