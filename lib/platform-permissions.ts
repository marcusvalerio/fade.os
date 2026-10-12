import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, requireAuthenticatedUser, TenancyError } from "@/lib/tenancy";

/**
 * Autorização de PLATAFORMA — separada da autorização de empresa
 * (`lib/permissions.ts`, `lib/tenancy.ts`). Ser owner/admin de uma company
 * não passa por aqui e não concede nada aqui; este nível não depende de
 * nenhum vínculo em `user_company_role`. A fonte de verdade é a tabela
 * `platform_admin` no banco, checada via a função `is_platform_admin`
 * (SECURITY DEFINER) — nunca inferida de metadata do usuário, que ele
 * mesmo poderia editar.
 *
 * Esconder o menu do CORTEX ADMIN não protege nada — cada Server Action
 * abaixo dele chama `requirePlatformAdmin()` de novo, porque uma Server
 * Action é um endpoint HTTP e pode ser chamada direto.
 */

/**
 * Admin ativo COM sessão administrativa aberta neste navegador
 * (platform_admin_sessao, 8 h, aberta só por /admin/login). Ser platform admin
 * e estar logado no CORTEX.OS não basta: é isto que separa o Admin do app.
 */
export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  // ARCH 2: reaproveita o seam já memoizado de lib/tenancy.ts em vez de
  // chamar supabase.auth.getUser() de novo — mesma checagem de presença,
  // um bypass a menos da fronteira de identidade.
  const user = await getSessionUser();
  if (!user) return false;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_sessao_ativa");
  if (error) return false;
  return data === true;
});

/** A pessoa logada É platform admin (independe de ter aberto a sessão do Admin). */
export const ehPlatformAdmin = cache(async (): Promise<boolean> => {
  const user = await getSessionUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("eu_sou_platform_admin");
  return !error && data === true;
});

export async function requirePlatformAdmin(): Promise<{ userId: string }> {
  const user = await requireAuthenticatedUser();

  if (!(await isPlatformAdmin())) {
    throw new TenancyError("Você não tem acesso ao CORTEX ADMIN.");
  }

  return { userId: user.id };
}
