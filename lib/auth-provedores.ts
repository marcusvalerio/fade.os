export type ProvedoresOAuth = { google: boolean };

/**
 * Quais provedores de login social estão LIGADOS no Supabase Auth deste
 * projeto — lido do próprio Supabase (`/auth/v1/settings`, endpoint público
 * que o painel alimenta), nunca de uma flag no código.
 *
 * O CORTEX oferece só o Google além de e-mail e senha. O botão aparece
 * apenas com o provedor ligado: um botão para um provedor desligado levaria
 * a pessoa a uma página de erro crua do Supabase. O fluxo inteiro
 * (signInWithOAuth → /auth/oauth-callback → "/") já existe; ligar ou
 * desligar o Google no painel (Authentication → Providers) mostra ou esconde
 * o botão sem deploy.
 *
 * Revalidado a cada 5 minutos. Qualquer falha de rede conta como "desligado":
 * na dúvida, o login mostra só o que certamente funciona (e-mail e senha).
 */
export async function provedoresOAuth(): Promise<ProvedoresOAuth> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) return { google: false };

  try {
    const resposta = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: chave },
      next: { revalidate: 300 },
    });
    if (!resposta.ok) return { google: false };
    const dados = (await resposta.json()) as { external?: Record<string, boolean> };
    return { google: dados.external?.google === true };
  } catch {
    return { google: false };
  }
}
