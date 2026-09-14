"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * P1.2 — Google OAuth pelo mecanismo nativo do Supabase Auth
 * (signInWithOAuth), nunca uma implementação própria de OAuth. Precisa do
 * provedor Google configurado no painel do Supabase (client id/secret do
 * Google Cloud) — sem isso, a chamada retorna um erro real do Supabase
 * dizendo que o provedor não está habilitado, nunca um erro inventado
 * aqui. O código funciona da mesma forma nos dois casos; o que muda é se
 * o provedor foi ligado do lado de fora do app.
 */
export function GoogleSignInButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setError(null);
    setPending(true);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/oauth-callback` },
    });
    if (oauthError) {
      setPending(false);
      setError(oauthError.message);
    }
    // Em sucesso o navegador é redirecionado para o Google — não há
    // estado de "concluído" para mostrar aqui.
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="secondary" className="w-full" onClick={handleClick} pending={pending}>
        <GoogleIcon />
        Continuar com Google
      </Button>
      {error && <p className="text-body-sm text-danger-ink">{error}</p>}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.54 5.54 0 0 1-2.4 3.64v3h3.89c2.27-2.09 3.56-5.17 3.56-8.83Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.89-3c-1.08.73-2.46 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.94H1.27v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.28 14.31A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.58.38-2.31v-3.1H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.41l4.01-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.27 6.59l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75Z" />
    </svg>
  );
}
