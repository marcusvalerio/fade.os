import type { Result } from "@/application/result";
import type { Identity } from "./identity";

/**
 * Porta de autenticação — as únicas operações de "provar quem é essa
 * pessoa" que o CORTEX realmente usa hoje (ARCH 2). Cada método espelha
 * 1:1 uma chamada real a `supabase.auth.*` já existente em
 * `actions/auth.ts`, `actions/platform-auth.ts` e os route handlers de
 * callback em `app/auth/` — não é uma lista genérica de capacidades de um
 * provedor de identidade, é exatamente o que este produto chama hoje.
 *
 * Deliberadamente fora daqui: as operações de administração de identidade
 * (`admin.auth.admin.createUser/updateUserById/deleteUser`, usadas por
 * `actions/profissional-acesso.ts`, `actions/conta.ts` e
 * `actions/platform-admin.ts` para o e-mail sintético de profissional e
 * para a saga de aprovação de Beta). Misturar essas duas responsabilidades
 * numa única porta genérica apagaria a semântica de "isto é provisionamento
 * administrativo de conta", não "autenticação de quem está pedindo" — o
 * próprio ARCH 2 pede para tratar isso com cuidado à parte, na Application
 * layer da ARCH 4, não aqui.
 */
export interface AuthProvider {
  signUpWithPassword(params: { email: string; password: string; name: string }): Promise<Result<void>>;

  signInWithPassword(params: { email: string; password: string }): Promise<Result<{ identity: Identity | null }>>;

  /** Sem retorno de erro: nenhum dos três call sites atuais verifica o erro
   *  de signOut — preservar esse comportamento exatamente. */
  signOut(): Promise<void>;

  requestPasswordReset(params: { email: string; redirectTo: string }): Promise<Result<void>>;

  updatePassword(params: { password: string }): Promise<Result<void>>;

  /** Troca o `?code=` que o Supabase anexa ao link de e-mail/OAuth por uma
   *  sessão real — usado pelos dois route handlers de callback. */
  exchangeCodeForSession(code: string): Promise<Result<void>>;
}
