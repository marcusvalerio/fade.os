-- P1 (auditoria R24 §4, revalidada nesta rodada de fechamento pré-beta):
-- qualquer staff autenticado conseguia ler e-mail, telefone completo e
-- percentual de comissão de QUALQUER colega da mesma empresa via REST
-- direto (PostgREST), porque a RLS de `professional` filtra só por linha
-- (company_id), nunca por coluna, e nenhuma tela do produto precisa desses
-- três campos de um colega — só do próprio profissional ou, para
-- gerência, de qualquer um.
--
-- Duas exceções legítimas e já em produção, confirmadas por leitura do
-- código antes desta migration: `app/(app)/dashboard/ProximosAtendimentos.tsx`
-- e `app/(app)/comissoes/page.tsx` usam os ÚLTIMOS 4 DÍGITOS do telefone de
-- colegas (nunca o número inteiro) para desempatar homônimos
-- (`lib/pessoas.ts`, `finalDoTelefone`). Essa necessidade é preservada por
-- uma coluna gerada de baixa sensibilidade (`phone_last4`), em vez de
-- quebrar a funcionalidade ou reabrir o número inteiro.
--
-- Mecanismo: coluna gerada de 4 dígitos (grant liberado, baixa
-- sensibilidade) + revogação de SELECT em nível de COLUNA para email/phone/
-- default_commission_percent + view `professional_directory`
-- (SECURITY DEFINER por padrão — sem `security_invoker`, de propósito: se
-- fosse invoker, o próprio CASE WHEN precisaria de privilégio de coluna
-- para o chamador, o que anularia a revogação acima) que devolve o valor
-- real só para o próprio usuário ou para quem tem
-- has_company_management_access(company_id), e null para os demais. Todo
-- ponto de leitura gerencial/self do código muda para ler da view; nenhum
-- ponto de escrita muda (INSERT/UPDATE continuam na tabela base, já
-- protegidos por RLS+trigger de gerência).

alter table public.professional
  add column if not exists phone_last4 text
  generated always as (
    case
      when phone is not null and length(regexp_replace(phone, '\D', '', 'g')) >= 4
        then right(regexp_replace(phone, '\D', '', 'g'), 4)
      else null
    end
  ) stored;

comment on column public.professional.phone_last4 is
  'Últimos 4 dígitos do telefone, gerado automaticamente. Baixa sensibilidade '
  'de propósito: é o único identificador de telefone que qualquer colega da '
  'mesma empresa pode ler direto da tabela base (usado para desempatar '
  'homônimos em Início/Comissões). O telefone completo só sai pela view '
  'professional_directory, mascarado para quem não é o próprio dono nem '
  'gerência.';

-- Fecha o acesso de coluna direto na tabela base: authenticated deixa de
-- poder ler email/phone/default_commission_percent de QUALQUER linha,
-- independentemente de RLS de linha (RLS não filtra coluna).
revoke select on public.professional from authenticated;

grant select (
  id, company_id, unit_id, user_id, name, role_title, active,
  avatar_url, created_at, updated_at, phone_last4
) on public.professional to authenticated;

-- View mascarada: SECURITY DEFINER implícito (sem security_invoker) —
-- roda com o privilégio do dono da view (que tem acesso irrestrito à
-- tabela base), não do chamador. Isso é necessário justamente porque acima
-- revogamos o privilégio de coluna do chamador: uma view "invoker" bateria
-- na mesma parede ao montar o CASE WHEN, mesmo quando o resultado real é
-- null. A fronteira de tenant é replicada explicitamente aqui (mesma regra
-- de my_company_ids() que a RLS de professional usa) porque o dono da view
-- normalmente ignora RLS de linha.
create or replace view public.professional_directory as
select
  p.id,
  p.company_id,
  p.unit_id,
  p.user_id,
  p.name,
  p.role_title,
  p.active,
  p.avatar_url,
  p.created_at,
  p.updated_at,
  p.phone_last4,
  case
    when public.has_company_management_access(p.company_id) or p.user_id = auth.uid()
      then p.email
    else null
  end as email,
  case
    when public.has_company_management_access(p.company_id) or p.user_id = auth.uid()
      then p.phone
    else null
  end as phone,
  case
    when public.has_company_management_access(p.company_id)
      then p.default_commission_percent
    else null
  end as default_commission_percent
from public.professional p
where p.company_id in (select public.my_company_ids());

grant select on public.professional_directory to authenticated;
