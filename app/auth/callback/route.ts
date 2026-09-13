import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Ponto de chegada do link de recuperação de senha (e de qualquer outro
 * fluxo de e-mail do Supabase Auth que use o mesmo padrão, como confirmação
 * de cadastro). O Supabase redireciona para cá com `?code=...` depois de
 * validar o token do e-mail no servidor dele — aqui só se troca esse código
 * por uma sessão de verdade (`exchangeCodeForSession`). Nenhum token de
 * recuperação é lido, gerado ou guardado por este app: quem emite e valida
 * o código é inteiramente o Supabase.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[fade-os] falha ao trocar código de recuperação por sessão:", error.message);
  }

  // Sem código, ou código inválido/expirado: manda para a própria tela de
  // redefinição com o estado de erro, que oferece pedir um novo link — nunca
  // um erro técnico cru.
  return NextResponse.redirect(`${origin}/redefinir-senha?error=invalid`);
}
