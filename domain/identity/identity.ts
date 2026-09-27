/**
 * Identidade autenticada — a forma que Application/Domain conhecem de
 * "quem está logado", sem depender do tipo `User` do `@supabase/supabase-js`.
 *
 * Campos definidos a partir do uso real no código (ARCH 2), não copiados de
 * uma lista genérica: `id` é lido em ~20 pontos (tenancy, permissions,
 * onboarding, comissões, exclusão de conta...); `email` e `name` são os
 * únicos dois campos de metadata realmente consumidos (nome de exibição em
 * app/(app)/layout.tsx, app/(app)/dashboard/page.tsx e
 * actions/profissionais.ts — os três liam `user.user_metadata?.name` com a
 * mesma lógica de trim + fallback, repetida três vezes).
 */
export type Identity = {
  id: string;
  email: string | null;
  name: string | null;
  /** Quando a pessoa viu (ou pulou) a apresentação do produto; null = nunca. */
  apresentacaoVistaEm: string | null;
};
