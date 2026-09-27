-- ============================================================================
-- Barbearias do cliente autenticado
-- ============================================================================
--
-- O cliente final não lê `company` (RLS: só membros da equipe). Para levar
-- quem entrou como cliente para a sua área — e nunca para o onboarding de
-- dono, que criaria uma barbearia por engano — o app precisa saber a quais
-- barbearias o próprio usuário está vinculado. Só endereço e nome, só das
-- barbearias do vínculo de auth.uid().
-- ============================================================================

create or replace function public.get_my_client_barbershops()
returns table (slug text, name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.slug, c.name
    from public.client_identity ci
    join public.company c on c.id = ci.company_id
   where ci.user_id = auth.uid()
   order by ci.created_at;
$$;

revoke all on function public.get_my_client_barbershops() from public, anon;
grant execute on function public.get_my_client_barbershops() to authenticated;
