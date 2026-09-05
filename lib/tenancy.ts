import { createClient } from "@/lib/supabase/server";

/**
 * O RLS no banco já é a barreira real de isolamento entre empresas — nenhuma
 * dessas verificações substitui as policies. Isso existe como segunda
 * camada: falha rápido, com uma mensagem clara, antes de depender do banco
 * rejeitar via RLS (que também rejeitaria, só que com um erro técnico de
 * Postgres). Nunca confie em company_id vindo do cliente sem essa checagem.
 */
export class TenancyError extends Error {}

export async function requireAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new TenancyError("Sessão expirada, faça login novamente.");
  }

  return user;
}

export async function requireCompanyAccess(companyId: string): Promise<void> {
  const supabase = await createClient();
  const user = await requireAuthenticatedUser();

  const { data, error } = await supabase
    .from("user_company_role")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) {
    throw new TenancyError("Você não tem acesso a esta empresa.");
  }
}
