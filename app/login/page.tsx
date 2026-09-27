import type { Metadata } from "next";
import { provedoresOAuth } from "@/lib/auth-provedores";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Entrar — CORTEX.OS",
};

/**
 * O login é montado no servidor só para saber quais provedores sociais estão
 * ligados no Supabase (lib/auth-provedores.ts) e se o retorno do OAuth
 * falhou (?error=oauth, vindo de /auth/oauth-callback). O formulário em si é
 * o cliente de sempre: as mesmas Server Actions signIn/signUp.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [provedores, params] = await Promise.all([provedoresOAuth(), searchParams]);
  return <LoginForm provedores={provedores} erroOAuth={params.error === "oauth"} />;
}
