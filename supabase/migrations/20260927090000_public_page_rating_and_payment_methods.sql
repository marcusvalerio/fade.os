-- Expõe dois fatos reais que já existiam no banco mas nunca chegaram à
-- página pública: a avaliação média da empresa (attendance_rating, hoje só
-- lida internamente) e as formas de pagamento aceitas (payment_method, hoje
-- só usada na configuração do PDV). Nenhuma tabela nova, nenhuma mudança de
-- RLS/policy — só duas leituras agregadas, no mesmo padrão SECURITY
-- DEFINER + slugify das demais funções get_public_*.

create or replace function public.get_public_company_rating(p_slug text)
returns table (
  average_stars numeric,
  rating_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select round(avg(ar.stars), 1) as average_stars, count(*) as rating_count
  from public.attendance_rating ar
  join public.company c on c.id = ar.company_id
  where c.slug = public.slugify(p_slug);
$$;

revoke all on function public.get_public_company_rating(text) from public;
grant execute on function public.get_public_company_rating(text) to anon, authenticated;

-- Só o nome do método, nunca dado de configuração de checkout — a mesma
-- projeção mínima que as outras funções públicas já praticam.
create or replace function public.get_public_payment_methods(p_slug text)
returns table (
  method text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pm.method
  from public.payment_method pm
  join public.company c on c.id = pm.company_id
  where c.slug = public.slugify(p_slug)
    and pm.active
  order by pm.method;
$$;

revoke all on function public.get_public_payment_methods(text) from public;
grant execute on function public.get_public_payment_methods(text) to anon, authenticated;
