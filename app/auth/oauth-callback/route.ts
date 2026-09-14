import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * P1.2 — callback do Google OAuth. Deliberadamente uma rota própria,
 * separada de app/auth/callback/route.ts (a de recuperação de senha) —
 * aquela rota já foi investigada a fundo por um bug real de produção
 * (ver docs/recuperacao-de-senha.md) e tem destino fixo por desenho; misturar
 * os dois fluxos na mesma rota reintroduziria exatamente esse risco.
 *
 * Destino sempre "/": a mesma porta de entrada que login por e-mail/senha
 * já usa (app/page.tsx decide onboarding vs. agenda) — conta nova via
 * Google cai no mesmo caminho de "sem empresa ainda" que uma conta nova
 * por e-mail, sem lógica duplicada.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/`);
    }
    console.error("[cortex-os] falha ao trocar código OAuth por sessão:", error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
