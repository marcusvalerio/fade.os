export type ProvedoresOAuth = { google: boolean; apple: boolean };

/**
 * Quais provedores de login social estão LIGADOS no Supabase Auth deste
 * projeto — lido do próprio Supabase (`/auth/v1/settings`, endpoint público
 * que o painel alimenta), nunca de uma flag no código.
 *
 * O login mostra "Continuar com Apple/Google" só para o que estiver ligado:
 * um botão para um provedor desligado levaria a pessoa a uma página de erro
 * crua do Supabase. Ligar o provedor no painel (Authentication → Providers,
 * com as credenciais do Google Cloud / Apple Developer) faz o botão aparecer
 * sozinho, sem deploy — o fluxo inteiro (signInWithOAuth →
 * /auth/oauth-callback → "/") já existe.
 *
 * Revalidado a cada 5 minutos. Qualquer falha de rede conta como "desligado":
 * na dúvida, o login mostra só o que certamente funciona (e-mail e senha).
 */
export async function provedoresOAuth(): Promise<ProvedoresOAuth> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) return { google: false, apple: false };

  try {
    const resposta = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: chave },
      next: { revalidate: 300 },
    });
    if (!resposta.ok) return { google: false, apple: false };
    const dados = (await resposta.json()) as { external?: Record<string, boolean> };
    return { google: dados.external?.google === true, apple: dados.external?.apple === true };
  } catch {
    return { google: false, apple: false };
  }
}
