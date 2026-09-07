import { cache } from "react";
import { cookies } from "next/headers";
import { getUserCompanyLinks } from "@/lib/tenancy";

export const ACTIVE_COMPANY_COOKIE = "fade_active_company";

/**
 * Contexto da empresa ativa: nunca "primeira company encontrada" como
 * decisão de tenancy — a lista de empresas do usuário sempre vem inteira
 * de user_company_role (RLS-escopada), e a escolha de QUAL delas é a
 * ativa agora é explícita, guardada num cookie e validada contra o
 * próprio vínculo do usuário a cada leitura (nunca confia cegamente no
 * cookie). Sem cookie válido — primeiro acesso, ou usuário perdeu o
 * vínculo com a empresa salva — cai para a mais antiga, que continua
 * sendo uma escolha determinística e documentada, não um acidente.
 *
 * A consulta em si mora em getUserCompanyLinks, memoizada por request:
 * o layout e cada página abaixo dele chamam esta função, e todas as
 * chamadas depois da primeira não tocam mais o banco.
 */
export const getCurrentCompany = cache(async () => {
  const links = await getUserCompanyLinks();
  if (links.length === 0) return null;

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;
  const active = (activeId && links.find((l) => l.company_id === activeId)) || links[0];

  return {
    company: active.company,
    roleKey: active.role_key,
    availableCompanies: links.map((l) => ({ id: l.company_id, name: l.company.name })),
  };
});
