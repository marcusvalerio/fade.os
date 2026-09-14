import { cookies } from "next/headers";

export const ACTIVE_MODE_COOKIE = "cortex_active_mode";

export type ActiveMode = "admin" | "atendimento";

/**
 * "Modo" é só uma preferência de qual scope de navegação mostrar quando a
 * mesma conta tem os dois contextos (owner/admin + professional vinculado)
 * na empresa ativa. Nunca é lido por nenhuma checagem de autorização —
 * quem decide o que a pessoa pode fazer continua sendo user_company_role
 * (RLS + requireCompanyManager), exatamente como antes. Trocar de modo não
 * muda role nenhum; só troca qual conjunto de telas aparece.
 */
export async function getActiveMode(): Promise<ActiveMode> {
  const cookieStore = await cookies();
  const value = cookieStore.get(ACTIVE_MODE_COOKIE)?.value;
  return value === "atendimento" ? "atendimento" : "admin";
}
