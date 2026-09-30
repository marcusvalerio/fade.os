"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requestPasswordReset, type ResetRequestState } from "@/actions/auth";
import { COOKIE_RECUPERACAO, DESTINO_RECUPERACAO_ADMIN, destinoDepoisDaEntrada } from "@/lib/admin-entrada";
import { createSupabaseAuthProvider } from "@/infrastructure/auth/supabase/auth-provider";

const authProvider = createSupabaseAuthProvider();

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe sua senha"),
});

export type PlatformAuthState = { error: string | null };

export async function signInPlatformAdmin(
  _prevState: PlatformAuthState,
  formData: FormData
): Promise<PlatformAuthState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const result = await authProvider.signInWithPassword(parsed.data);
  if (!result.ok) return { error: "E-mail ou senha incorretos" };

  const supabase = await createClient();
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_platform_admin");

  if (adminError || isAdmin !== true) {
    await authProvider.signOut();
    return { error: "Esta conta não possui acesso ao CORTEX ADMIN" };
  }

  redirect(destinoDepoisDaEntrada(String(formData.get("proximo") ?? "") || null));
}

/**
 * Sair do Admin. Volta para /admin/login, nunca para o login do app.
 *
 * PENDENTE — REQUER ACESSO AO SUPABASE: com a sessão administrativa própria
 * (`platform_admin_sessao`), sair do Admin encerra só ela e mantém a pessoa
 * dentro do CORTEX.OS. Hoje as duas áreas usam a mesma sessão do Supabase,
 * então sair do Admin sai de tudo — e a tela de login diz isso.
 */
export async function sairDoAdmin() {
  await authProvider.signOut();
  redirect("/admin/login?saiu=1");
}

/**
 * Recuperação de senha pedida na entrada do Admin. É o mesmo pedido do app
 * (mesmo Supabase, mesma conta, mesmo endereço de retorno já liberado); o
 * cookie curto só diz ao callback que a volta é para /admin/redefinir-senha.
 * Não muda nada na configuração do Supabase.
 */
export async function solicitarRecuperacaoDoAdmin(
  prevState: ResetRequestState,
  formData: FormData
): Promise<ResetRequestState> {
  const resultado = await requestPasswordReset(prevState, formData);
  if (resultado.success) {
    (await cookies()).set(COOKIE_RECUPERACAO, DESTINO_RECUPERACAO_ADMIN, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60,
    });
  }
  return resultado;
}
