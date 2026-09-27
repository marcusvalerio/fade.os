/**
 * Como a sessão atual foi aberta — lido da claim `amr` do access token do
 * Supabase ([{ method: "password" | "oauth" | "otp" | "recovery" | … }]).
 *
 * Serve a uma regra só: a gestão da barbearia entra com e-mail e senha; o
 * Google é da área do cliente. Como o Supabase liga as formas de entrar pelo
 * e-mail verificado, uma pessoa da equipe que use "Continuar com o Google" na
 * página da barbearia recebe uma sessão da mesma conta — o middleware usa
 * isto para não deixar essa sessão entrar no produto interno.
 *
 * Só decodifica o payload: quem chama já validou o token (getUser no
 * middleware). Token ilegível conta como "não sei" e não bloqueia nada.
 */
export function metodosDaSessao(accessToken: string): string[] {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return [];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const amr = (JSON.parse(json) as { amr?: unknown }).amr;
    if (!Array.isArray(amr)) return [];
    return amr
      .map((m) => (typeof m === "string" ? m : (m as { method?: unknown })?.method))
      .filter((m): m is string => typeof m === "string");
  } catch {
    return [];
  }
}

/** A sessão veio do login social (Google) e não de e-mail e senha. */
export function entrouPeloGoogle(accessToken: string): boolean {
  const metodos = metodosDaSessao(accessToken);
  return metodos.includes("oauth") && !metodos.includes("password");
}
