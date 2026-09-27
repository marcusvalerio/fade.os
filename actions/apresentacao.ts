"use server";

import { createSupabaseAuthProvider } from "@/infrastructure/auth/supabase/auth-provider";

const authProvider = createSupabaseAuthProvider();

/**
 * A pessoa terminou (ou pulou) a apresentação de primeiro acesso. Fica nos
 * metadados do próprio usuário — é preferência de interface, não
 * permissão: a apresentação só deixa de abrir sozinha. "Rever apresentação"
 * (menu da conta e Ajuda) continua abrindo quando a pessoa quiser.
 */
export async function marcarApresentacaoVista(): Promise<void> {
  await authProvider.markPresentationSeen(new Date().toISOString());
}
