-- FADE OS — Fase 3 (complemento): time geral da barbearia para a página
-- pública (seção 5 pede "profissionais disponíveis" como parte da
-- identidade da barbearia, distinto da lista já filtrada por serviço que
-- get_public_professionals() devolve dentro do fluxo de agendamento).
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
  from public.professional p
  join public.company c on c.id = p.company_id
  where c.slug = public.slugify(p_slug)
    and p.active
  order by p.name;
$$;

revoke all on function public.get_public_team(text) from public;
grant execute on function public.get_public_team(text) to anon, authenticated;
