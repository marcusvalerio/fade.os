import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_COMPANY_COOKIE = "fade_active_company";

type CompanyLink = {
  company_id: string;
  role: { key: string } | null;
  company: { id: string; name: string; slug: string; logo_url: string | null };
};

/**
 * Contexto da empresa ativa: nunca "primeira company encontrada" como
 * decisão de tenancy — a lista de empresas do usuário sempre vem inteira
 * de user_company_role (RLS-escopada), e a escolha de QUAL delas é a
 * ativa agora é explícita, guardada num cookie e validada contra o
 * próprio vínculo do usuário a cada leitura (nunca confia cegamente no
 * cookie). Sem cookie válido — primeiro acesso, ou usuário perdeu o
 * vínculo com a empresa salva — cai para a mais antiga, que continua
 * sendo uma escolha determinística e documentada, não um acidente.
 */
export async function getCurrentCompany() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: links, error } = await supabase
    .from("user_company_role")
    .select("company_id, role:role_id(key), company:company_id(id, name, slug, logo_url)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error || !links || links.length === 0) return null;

  const typedLinks = links as unknown as CompanyLink[];

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;
  const active = (activeId && typedLinks.find((l) => l.company_id === activeId)) || typedLinks[0];

  return {
    company: active.company,
    roleKey: active.role?.key ?? null,
    availableCompanies: typedLinks.map((l) => ({ id: l.company_id, name: l.company.name })),
  };
}
