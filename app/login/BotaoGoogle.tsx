"use client";

import { useState } from "react";
import { marcarEntrada, desmarcarEntrada } from "@/lib/entrada";

/**
 * Login com o Google pelo mecanismo nativo do Supabase Auth
 * (signInWithOAuth) — nunca um OAuth próprio, nenhum segredo no navegador.
 * Volta por /auth/oauth-callback, que manda para "/" (a mesma porta de
 * entrada do login por e-mail). Só aparece com o Google ligado no painel do
 * Supabase (ver lib/auth-provedores.ts).
 *
 * O rótulo segue a diretriz da marca em português ("Continuar com o
 * Google"). O cliente do Supabase só é carregado no clique: quem entra por
 * e-mail não baixa o SDK.
 */
export function BotaoGoogle() {
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar() {
    setErro(null);
    setPendente(true);
    marcarEntrada();
    let falhou = false;
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/oauth-callback` },
      });
      falhou = Boolean(error);
    } catch {
      falhou = true;
    }
    // Em sucesso o navegador já saiu para o Google; só o erro volta aqui.
    if (falhou) {
      desmarcarEntrada();
      setPendente(false);
      setErro("Não foi possível abrir o login com o Google. Tente de novo ou entre com e-mail.");
    }
  }

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={entrar}
        disabled={pendente}
        className="alvo-toque h-11 w-full inline-flex items-center justify-center gap-2.5 rounded-sm border border-border-strong bg-surface text-button text-foreground transition-[opacity,background-color] duration-fast ease-standard hover:bg-surface-muted disabled:opacity-60"
      >
        {pendente ? <span aria-hidden className="sinal-carregando" /> : <IconeGoogle />}
        Continuar com o Google
      </button>
      {erro && (
        <p className="text-body-sm text-danger-ink" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}

function IconeGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.54 5.54 0 0 1-2.4 3.64v3h3.89c2.27-2.09 3.56-5.17 3.56-8.83Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.89-3c-1.08.73-2.46 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.94H1.27v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.28 14.31A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.58.38-2.31v-3.1H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.41l4.01-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.27 6.59l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75Z" />
    </svg>
  );
}
