"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { friendlyAuthMessage } from "@/lib/errors";
import { passwordSchema, emailSchema, passwordsMatch } from "@/lib/auth-validation";

const signUpSchema = z.object({ name: z.string().min(2, "Informe seu nome"), email: z.string().email("E-mail inválido"), password: passwordSchema });
const signInSchema = z.object({ email: z.string().email("E-mail inválido"), password: z.string().min(1, "Informe sua senha") });
const identifierSchema = z.string().regex(/^[A-Za-z0-9]{6}$/, "Identificador inválido");

export type AuthActionState = { error: string | null };

export async function signUp(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({ name: formData.get("name"), email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password, options: { data: { name: parsed.data.name } } });
  if (error) { console.error("[fade-os] erro no signup:", error.message); return { error: friendlyAuthMessage(error.message) }; }
  redirect("/onboarding");
}

export async function signIn(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const mode = formData.get("mode");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  if (mode === "professional") {
    const identifier = identifierSchema.safeParse(String(formData.get("identifier") ?? "").trim().toUpperCase());
    if (!identifier.success || !password) return { error: "Identificador ou senha incorretos" };

    const { data: loginEmail, error: lookupError } = await supabase.rpc("get_professional_login_email", { p_identifier: identifier.data });
    if (lookupError || !loginEmail) return { error: "Identificador ou senha incorretos" };

    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    if (error) return { error: "Identificador ou senha incorretos" };

    const { data: access } = await supabase.from("professional_access").select("password_set_at, is_access_enabled").eq("access_identifier", identifier.data).maybeSingle();
    if (!access?.is_access_enabled) { await supabase.auth.signOut(); return { error: "Acesso desativado." }; }
    if (!access.password_set_at) redirect("/mudar-senha-inicial");
    redirect("/");
  }

  const parsed = signInSchema.safeParse({ email: formData.get("email"), password });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "E-mail ou senha incorretos" };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Origem confiável para montar o link de recuperação. `headers()` reflete o
 * cabeçalho `Origin`/`Host` que o navegador manda de verdade nesta
 * requisição — não é um valor digitado em formulário nem um env var fixo, o
 * que evita hardcodar localhost/preview/produção e evita aceitar uma origem
 * arbitrária vinda do cliente. A barreira real contra um host forjado é do
 * lado do Supabase: o projeto só honra `redirectTo` que estiver na lista de
 * Redirect URLs (Authentication → URL Configuration) — sem entrada lá, o
 * link cai para a Site URL padrão do projeto. Ver docs/recuperacao-de-senha.md.
 */
async function trustedOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export type ResetRequestState = { error: string | null; success: boolean };

const resetRequestSchema = z.object({ email: emailSchema });

/**
 * "Esqueci minha senha" — só para contas com e-mail real (dono/gerência).
 * Profissionais logam por identificador com um e-mail interno sintético
 * (`<identificador>@login.fade.os`, sem caixa de entrada de verdade) — para
 * eles, o caminho de recuperação continua sendo o gerente resetar o acesso
 * em Equipe, não este formulário.
 *
 * Resposta sempre neutra: o Supabase já não diferencia e-mail existente de
 * inexistente nesta chamada (nunca retorna erro por "usuário não encontrado"
 * aqui, por desenho, exatamente para evitar enumeração de contas) — o código
 * só preserva essa neutralidade, não a implementa.
 */
export async function requestPasswordReset(
  _prevState: ResetRequestState,
  formData: FormData
): Promise<ResetRequestState> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, success: false };

  const supabase = await createClient();
  const origin = await trustedOrigin();

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/redefinir-senha`,
  });

  // Erro de limite de tentativas não revela se a conta existe — é seguro
  // mostrar. Qualquer outro erro também vira a mesma mensagem neutra de
  // sucesso, para não abrir uma trinca de enumeração por tipo de erro.
  if (error) {
    console.error("[fade-os] erro ao solicitar recuperação de senha:", error.message);
    if (/email rate limit/i.test(error.message)) {
      return { error: friendlyAuthMessage(error.message), success: false };
    }
  }

  return { error: null, success: true };
}

export type UpdatePasswordState = { error: string | null; success: boolean };

/**
 * Definir a nova senha depois do link de recuperação. Exige a sessão que
 * `exchangeCodeForSession` (em app/auth/callback/route.ts) já deve ter
 * criado — sem sessão válida, não há o que atualizar. `updateUser` só troca
 * a senha desta conta: company/role/professional/RLS continuam exatamente
 * os mesmos, porque nada aqui toca user_company_role/professional.
 */
export async function updatePasswordAfterRecovery(
  _prevState: UpdatePasswordState,
  formData: FormData
): Promise<UpdatePasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { error: parsed.error.issues[0].message, success: false };
  if (!passwordsMatch(password, confirmation)) return { error: "As senhas não coincidem.", success: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: "Este link expirou ou já foi usado. Solicite uma nova recuperação de senha.",
      success: false,
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    console.error("[fade-os] erro ao redefinir senha:", error.message);
    return { error: friendlyAuthMessage(error.message), success: false };
  }

  return { error: null, success: true };
}
