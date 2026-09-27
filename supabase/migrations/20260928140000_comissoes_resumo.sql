-- Comissões: resumo por profissional e pagamento do pendente de uma vez.
--
-- A tela somava "devido" sobre as 100 comissões mais recentes — com mais
-- histórico, o valor devido saía menor que o real. O resumo agora vem do
-- banco, sobre todas as linhas que quem pergunta pode ver (RLS: gestor vê a
-- empresa; profissional vê só as próprias).
--
-- 1. get_commission_summary(empresa, de, até) — por profissional:
--    pendente (devida, qualquer data), gerado no período (devida + paga,
--    pela data da venda), pago no período (pela data do pagamento) e
--    revertido no período.
-- 2. mark_commissions_paid(empresa, profissional, ids[]) — paga as
--    comissões devidas daquele profissional que a tela mostrou (os ids vêm
--    da tela: paga-se o que o gestor viu, não o que entrou depois). Cada
--    uma vai para a auditoria, como no pagamento individual.

create or replace function public.get_commission_summary(p_company_id uuid, p_from timestamptz, p_to timestamptz)
returns table(
  professional_id uuid,
  professional_name text,
  pendente numeric,
  pendente_qtd int,
  gerado numeric,
  pago numeric,
  revertido numeric
)
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $function$
  select c.professional_id,
         p.name,
         coalesce(sum(c.amount) filter (where c.status = 'due'), 0),
         (count(*) filter (where c.status = 'due'))::int,
         coalesce(sum(c.amount) filter (where c.status in ('due', 'paid') and c.created_at >= p_from and c.created_at < p_to), 0),
         coalesce(sum(c.amount) filter (where c.status = 'paid' and c.paid_at >= p_from and c.paid_at < p_to), 0),
         coalesce(sum(c.amount) filter (where c.status = 'reversed' and coalesce(c.reversed_at, c.updated_at) >= p_from and coalesce(c.reversed_at, c.updated_at) < p_to), 0)
    from public.commission c
    join public.professional p on p.id = c.professional_id
   where c.company_id = p_company_id
   group by c.professional_id, p.name
   order by p.name;
$function$;

create or replace function public.mark_commissions_paid(p_company_id uuid, p_professional_id uuid, p_ids uuid[])
returns table(pagas int, total numeric)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_linha record;
  v_pagas int := 0;
  v_total numeric := 0;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if not public.has_company_management_access(p_company_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) > 1000 then
    raise exception 'LISTA_INVALIDA' using errcode = '22023';
  end if;

  for v_linha in
    select id, amount from public.commission
     where id = any(p_ids) and company_id = p_company_id and professional_id = p_professional_id and status = 'due'
     for update
  loop
    update public.commission set status = 'paid', paid_at = now(), paid_by = auth.uid() where id = v_linha.id;
    perform public.write_audit_log(p_company_id, 'mark_commission_paid', 'commission', v_linha.id,
      jsonb_build_object('status', 'due'), jsonb_build_object('status', 'paid', 'lote', true), null);
    v_pagas := v_pagas + 1;
    v_total := v_total + v_linha.amount;
  end loop;

  pagas := v_pagas;
  total := v_total;
  return next;
end;
$function$;

revoke all on function public.get_commission_summary(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_commission_summary(uuid, timestamptz, timestamptz) to authenticated;
revoke all on function public.mark_commissions_paid(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.mark_commissions_paid(uuid, uuid, uuid[]) to authenticated;
