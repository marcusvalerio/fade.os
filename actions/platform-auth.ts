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

  // A sessão do Admin nasce aqui e só aqui: presa à sessão do Supabase que
  // acabou de ser criada, válida por 8 h. Quem não é admin não ganha sessão
  // (e a tentativa vai para a auditoria dentro da própria função).
  const supabase = await createClient();
  const { data: expira, error: sessaoError } = await supabase.rpc("admin_abrir_sessao");

  if (sessaoError || !expira) {
    await authProvider.signOut();
    return { error: "Esta conta não possui acesso ao CORTEX ADMIN" };
  }

  redirect(destinoDepoisDaEntrada(String(formData.get("proximo") ?? "") || null));
}

/**
 * Sair do Admin: encerra SÓ a sessão administrativa. Quem também usa o
 * CORTEX.OS (dono, gerente, profissional, cliente) continua logado nele.
 * Quem só existe como admin da plataforma sai de tudo — não faz sentido
 * deixar uma sessão aberta sem nada para abrir.
 */
export async function sairDoAdmin() {
  const supabase = await createClient();
  await supabase.rpc("admin_encerrar_sessao");

  const { data: { user } } = await supabase.auth.getUser();
  let usaOApp = false;
  if (user) {
    const [{ count: vinculos }, { data: barbearias }] = await Promise.all([
      supabase.from("user_company_role").select("company_id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.rpc("get_my_client_barbershops"),
    ]);
    usaOApp = (vinculos ?? 0) > 0 || ((barbearias as unknown[] | null)?.length ?? 0) > 0;
  }
  if (!usaOApp) await authProvider.signOut();
  redirect(usaOApp ? "/admin/login?saiu=1&app=1" : "/admin/login?saiu=1");
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

/**
 * Liga/desliga a exigência de sessão administrativa no BANCO (funções
 * admin_* e políticas). No app ela já vale sempre. Ligar também fecha
 * is_platform_admin para a API — o código antigo do Admin para de
 * funcionar, então só se liga com este código em produção.
 */
export async function definirExigenciaDeSessao(ligar: boolean): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_exigir_sessao", { p_ligar: ligar });
  if (error) return { ok: false, erro: "Não foi possível alterar. Abra o Admin pela entrada do Admin e tente de novo." };
  return { ok: true };
}
