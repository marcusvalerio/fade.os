import type { User } from "@supabase/supabase-js";
import type { Identity } from "@/domain/identity/identity";

/**
 * Mapeamento puro `User` (Supabase) → `Identity` (CORTEX). Reproduz
 * exatamente a lógica que antes vivia repetida em três call sites
 * (app/(app)/layout.tsx, app/(app)/dashboard/page.tsx,
 * actions/profissionais.ts): `user_metadata?.name` com trim, `null` se
 * vazio — nunca `undefined`, para o contrato do domínio não precisar
 * distinguir "nunca existiu" de "existe e está vazio".
 *
 * Separado de identity-adapter.ts de propósito: só imports de tipo aqui
 * (apagados na compilação), para o teste puro (to-identity.test.ts) não
 * precisar resolver `@/lib/supabase/server` — algo que só o bundler do
 * Next.js sabe fazer, não o `node --test` direto.
 */
export function toIdentity(user: User): Identity {
  const name = (user.user_metadata?.name as string | undefined)?.trim();
  const vista = user.user_metadata?.apresentacao_vista_em;
  return {
    id: user.id,
    email: user.email ?? null,
    name: name ? name : null,
    apresentacaoVistaEm: typeof vista === "string" && vista ? vista : null,
  };
}
