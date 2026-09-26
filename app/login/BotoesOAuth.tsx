"use client";

import { useState } from "react";
import { marcarEntrada, desmarcarEntrada } from "@/lib/entrada";
import type { ProvedoresOAuth } from "@/lib/auth-provedores";
import { cn } from "@/lib/cn";

type Provedor = "apple" | "google";

const NOME: Record<Provedor, string> = { apple: "a Apple", google: "o Google" };

/**
 * Login social pelo mecanismo nativo do Supabase Auth (signInWithOAuth) —
 * nunca um OAuth próprio. Volta por /auth/oauth-callback, que manda para "/"
 * (a mesma porta de entrada do login por e-mail). Só aparecem os provedores
 * ligados no painel do Supabase (ver lib/auth-provedores.ts).
 *
 * Os rótulos seguem as diretrizes de cada marca em português ("Continuar com
 * a Apple", "Continuar com o Google"); o botão da Apple é o preto oficial.
 *
 * O cliente do Supabase só é carregado no clique: quem entra por e-mail (a
 * maioria, e todos enquanto nenhum provedor está ligado) não baixa o SDK.
 */
export function BotoesOAuth({ provedores }: { provedores: ProvedoresOAuth }) {
  const [pendente, setPendente] = useState<Provedor | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const ativos = (["apple", "google"] as const).filter((p) => provedores[p]);
  if (ativos.length === 0) return null;

  async function entrar(provedor: Provedor) {
    setErro(null);
    setPendente(provedor);
    marcarEntrada();
    let falhou = false;
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const { error } = await createClient().auth.signInWithOAuth({
        provider: provedor,
        options: { redirectTo: `${window.location.origin}/auth/oauth-callback` },
      });
      falhou = Boolean(error);
    } catch {
      falhou = true;
    }
    // Em sucesso o navegador já saiu para o provedor; só o erro volta aqui.
    if (falhou) {
      desmarcarEntrada();
      setPendente(null);
      setErro(`Não foi possível abrir o login com ${NOME[provedor]}. Tente de novo ou entre com e-mail.`);
    }
  }

  return (
    <div className="space-y-2.5">
      {ativos.map((provedor) => (
        <button
          key={provedor}
          type="button"
          onClick={() => entrar(provedor)}
          disabled={pendente !== null}
          className={cn(
            "alvo-toque h-11 w-full inline-flex items-center justify-center gap-2.5 rounded-sm text-button",
            "transition-[opacity,background-color] duration-fast ease-standard disabled:opacity-60",
            provedor === "apple"
              ? "bg-black text-white hover:bg-black/85"
              : "border border-border-strong bg-surface text-foreground hover:bg-surface-muted"
          )}
        >
          {pendente === provedor ? (
            <span aria-hidden className="sinal-carregando" />
          ) : provedor === "apple" ? (
            <IconeApple />
          ) : (
            <IconeGoogle />
          )}
          Continuar com {NOME[provedor]}
        </button>
      ))}
      {erro && (
        <p className="text-body-sm text-danger-ink" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}

function IconeApple() {
  return (
    <svg width="16" height="18" viewBox="0 0 16 19" aria-hidden className="shrink-0 -mt-0.5" fill="currentColor">
      <path d="M13.24 10.08c-.02-2.08 1.7-3.08 1.78-3.13-.97-1.42-2.48-1.61-3.02-1.63-1.28-.13-2.51.76-3.16.76-.66 0-1.66-.74-2.73-.72-1.4.02-2.7.82-3.42 2.08-1.46 2.53-.37 6.27 1.05 8.33.7 1 1.52 2.13 2.6 2.09 1.04-.04 1.44-.67 2.7-.67 1.26 0 1.61.67 2.71.65 1.13-.02 1.84-1.02 2.52-2.03.8-1.17 1.13-2.3 1.15-2.36-.03-.01-2.2-.84-2.18-3.37ZM11.16 3.97c.58-.7.97-1.67.86-2.64-.83.03-1.84.55-2.44 1.25-.53.62-1 1.61-.88 2.56.93.07 1.88-.47 2.46-1.17Z" />
    </svg>
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
