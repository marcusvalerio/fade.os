-- BLOCO B: integridade entre acesso profissional e Supabase Auth.
-- A senha real pertence ao Supabase Auth; temporary_password_hash permanece
-- apenas como legado de compatibilidade do fluxo inicial.

-- O acesso é 1:1 com o profissional e nunca pode apontar para outra empresa.
create or replace function public.check_professional_access_same_company()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prof_company uuid;
begin
  select company_id into v_prof_company
  from public.professional
  where id = new.professional_id;

  if v_prof_company is null or v_prof_company <> new.company_id then
    raise exception 'Professional e access devem pertencer à mesma empresa.';
  end if;
  return new;
end;
$$;

-- Impede alteração direta do registro de acesso por profissional.
-- Toda ativação/desativação/reset continua passando pelas RPCs autorizadas.
drop policy if exists professional_access_update on public.professional_access;
create policy professional_access_update on public.professional_access
  for update to authenticated
  using (public.has_company_management_access(company_id))
  with check (public.has_company_management_access(company_id));

-- O profissional só pode concluir o próprio primeiro acesso.
-- A atualização do password_set_at é feita pela Server Action com o cliente
-- administrativo, portanto não depende desta policy.

comment on column public.professional_access.temporary_password_hash is
  'Compatibilidade histórica do fluxo inicial. A credencial efetiva é mantida pelo Supabase Auth; nunca exibir este valor.';
