-- FADE OS — Teste operacional, P1 #3: ativação de acesso ficava presa.
--
-- REPRODUZIDO: enable_professional_access grava a linha de professional_access;
-- em seguida a aplicação cria (ou atualiza) a conta no Supabase Auth. Quando
-- essa segunda parte falha, a compensação existente apenas marcava
-- is_access_enabled = false e ia embora. Os dois desfechos ruins:
--
--   (a) profissional SEM conta ainda — sobrava uma linha com
--       professional.user_id nulo, que a tela lia como "tem acesso,
--       desativado": o botão "Ativar Acesso" sumia, "Resetar Acesso" falhava
--       (não há conta para resetar) e não havia saída pela interface;
--
--   (b) profissional COM conta — enable_professional_access já tinha trocado
--       o identificador no banco, e o Auth continuava com o antigo. A tela
--       mostrava "Ativo" com um identificador que não autentica: o login
--       resolve o e-mail sintético a partir do identificador gravado aqui, e
--       esse e-mail não existe do outro lado.
--
-- A compensação certa depende do que existia antes, então esta função recebe
-- o estado anterior e o restaura:
--
--   - não havia linha  → apaga (o acesso nunca chegou a existir);
--   - havia linha      → devolve identificador, senha e situação de antes.
--
-- Não é destrutivo: mexe apenas na linha do profissional indicado.
create or replace function public.rollback_professional_access(
  p_professional_id uuid,
  p_company_id uuid,
  p_previous_identifier text default null,
  p_previous_enabled boolean default null,
  p_previous_password_set_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.has_company_management_access(p_company_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.professional
    where id = p_professional_id and company_id = p_company_id
  ) then
    raise exception 'PROFESSIONAL_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_previous_identifier is null then
    delete from public.professional_access
      where professional_id = p_professional_id and company_id = p_company_id;
  else
    update public.professional_access
      set access_identifier = p_previous_identifier,
          is_access_enabled = coalesce(p_previous_enabled, false),
          password_set_at = p_previous_password_set_at
      where professional_id = p_professional_id and company_id = p_company_id;
  end if;
end;
$$;

revoke all on function public.rollback_professional_access(uuid, uuid, text, boolean, timestamptz) from public, anon;
grant execute on function public.rollback_professional_access(uuid, uuid, text, boolean, timestamptz) to authenticated;
