import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAuthProvider } from "@/infrastructure/auth/supabase/auth-provider";

const authProvider = createSupabaseAuthProvider();

/**
 * Ponto de chegada do link de recuperação de senha. O Supabase redireciona
 * para cá com `?code=...` depois de validar o token do e-mail no servidor
 * dele — aqui só se troca esse código por uma sessão de verdade
 * (`exchangeCodeForSession`). Nenhum token de recuperação é lido, gerado ou
 * guardado por este app: quem emite e valida o código é inteiramente o
 * Supabase. Destino sempre fixo em /redefinir-senha — esta rota não serve
 * nenhum outro fluxo de e-mail hoje (signUp não passa emailRedirectTo).
 */
// Destino fixo — este callback só existe para o fluxo de recuperação de
// senha, então não há por que aceitar um "next" arbitrário como query
// param. Um "?next=..." próprio no redirectTo colidia com o "?code=..."
// que o GoTrue anexa para montar o link do e-mail, produzindo uma única
// query string sem chave `code` de verdade — o código nunca chegava a
// exchangeCodeForSession. Ver actions/auth.ts::requestPasswordReset.
const DESTINO_APOS_RECUPERACAO = "/redefinir-senha";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const result = await authProvider.exchangeCodeForSession(code);
    if (result.ok) {
      return NextResponse.redirect(`${origin}${DESTINO_APOS_RECUPERACAO}`);
    }
    console.error("[cortex-os] falha ao trocar código de recuperação por sessão:", result.error);
  }

  // Sem código, ou código inválido/expirado: manda para a própria tela de
  // redefinição com o estado de erro, que oferece pedir um novo link — nunca
  // um erro técnico cru.
  return NextResponse.redirect(`${origin}/redefinir-senha?error=invalid`);
}
