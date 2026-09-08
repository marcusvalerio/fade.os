-- FADE OS — Teste operacional, P1 #3: ativação de acesso ficava presa.
--
-- REPRODUZIDO: enable_professional_access grava a linha de professional_access;
-- em seguida a aplicação cria a conta no Supabase Auth. Quando essa segunda
-- parte falha, a compensação existente apenas marcava is_access_enabled = false
-- e ia embora. Sobrava uma linha com:
--
--   professional_access.is_access_enabled = false
--   professional.user_id = null            (nenhuma conta foi criada)
--
-- Para a tela isso é "tem acesso, desativado": o botão "Ativar Acesso" some,
-- restam "Resetar Acesso" (que falha, porque não existe conta para resetar) e
-- "Desativar" (já está desativado). Sem saída pela interface — só intervenção
-- manual no banco. Reproduzido e confirmado depois de recarregar a página.
--
-- A compensação certa é apagar a linha: se a conta não chegou a existir, o
-- acesso não existe. Como professional_access não tem policy de DELETE (e não
-- deve ter — ninguém apaga trilha de acesso pelo PostgREST), a operação mora
-- numa função com o mesmo gate de gestão das outras.
--
-- Não é destrutivo: só apaga a linha do profissional indicado, e apenas
-- quando não existe conta de acesso vinculada.
create or replace function public.discard_professional_access(
  p_professional_id uuid,
  p_company_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.has_company_management_access(p_company_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select user_id into v_user_id
    from public.professional
    where id = p_professional_id and company_id = p_company_id;

  if not found then
    raise exception 'PROFESSIONAL_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Trava de segurança: isto é rollback de uma ativação que não chegou a
  -- criar conta. Se já existe conta vinculada, o caminho é desativar (que
  -- revoga o vínculo e bane o login), nunca apagar o registro de acesso.
  if v_user_id is not null then
    raise exception 'ACESSO_JA_PROVISIONADO' using errcode = '22023';
  end if;

  delete from public.professional_access
    where professional_id = p_professional_id and company_id = p_company_id;
end;
$$;

revoke all on function public.discard_professional_access(uuid, uuid) from public, anon;
grant execute on function public.discard_professional_access(uuid, uuid) to authenticated;
