import { createClient } from "@/lib/supabase/server";
import { toIdentity } from "./identity-adapter";
import type { AuthProvider } from "@/domain/identity/auth-provider";

/**
 * Implementação Supabase da porta `AuthProvider` (ARCH 2). Cada método é
 * um wrapper 1:1 sobre a chamada `supabase.auth.*` que já existia em
 * `actions/auth.ts`/`actions/platform-auth.ts`/route handlers de
 * callback — mesma chamada, mesmos parâmetros, mesma mensagem de erro
 * (`error.message`, sem tradução aqui: quem chama já traduz via
 * `friendlyAuthMessage`). Nenhuma regra nova, nenhuma validação nova.
 */
export function createSupabaseAuthProvider(): AuthProvider {
  return {
    async signUpWithPassword({ email, password, name, emailRedirectTo, metadata }) {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { ...metadata, name }, ...(emailRedirectTo ? { emailRedirectTo } : {}) },
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, data: { hasSession: Boolean(data.session) } };
    },

    async signInWithPassword({ email, password }) {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, error: error.message };
      return { ok: true, data: { identity: data.user ? toIdentity(data.user) : null } };
    },

    async signOut() {
      const supabase = await createClient();
      await supabase.auth.signOut();
    },

    async requestPasswordReset({ email, redirectTo }) {
      const supabase = await createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) return { ok: false, error: error.message };
      return { ok: true, data: undefined };
    },

    async updatePassword({ password }) {
      const supabase = await createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { ok: false, error: error.message };
      return { ok: true, data: undefined };
    },

    async exchangeCodeForSession(code) {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return { ok: false, error: error.message };
      return { ok: true, data: undefined };
    },
  };
}
