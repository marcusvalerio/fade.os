import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAuthProvider } from "@/infrastructure/auth/supabase/auth-provider";
import { createClient } from "@/lib/supabase/server";
import { COOKIE_CLIENTE } from "@/lib/cliente-conta";

const authProvider = createSupabaseAuthProvider();

/** Só um endereço de barbearia (slug) — nunca uma URL: o retorno não vira redirecionamento aberto. */
function slugValido(valor: string | null | undefined): string | null {
  return valor && /^[a-z0-9-]{1,80}$/.test(valor) ? valor : null;
}

/**
 * Retorno do Supabase Auth para o CLIENTE FINAL da barbearia: login com o
 * Google e o link de confirmação de e-mail do cadastro de cliente. (O login
 * da equipe é só e-mail e senha — não passa por aqui.)
 *
 * Separado de app/auth/callback/route.ts, que serve só à recuperação de senha
 * (ver docs/recuperacao-de-senha.md).
 *
 * Para qual barbearia voltar: o cookie `cortex-cliente`, marcado quando a
 * pessoa clicou em "Continuar com o Google" ou criou a conta; se o link de
 * confirmação foi aberto em outro navegador, a barbearia de origem vem nos
 * metadados do cadastro. /[slug]/minha-conta faz o vínculo (por e-mail
 * verificado) na primeira visita.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const slugDoCookie = slugValido(request.cookies.get(COOKIE_CLIENTE)?.value);

  const responder = (destino: string) => {
    const resposta = NextResponse.redirect(`${origin}${destino}`);
    if (slugDoCookie) resposta.cookies.delete(COOKIE_CLIENTE);
    return resposta;
  };

  if (code) {
    const result = await authProvider.exchangeCodeForSession(code);
    if (result.ok) {
      if (slugDoCookie) return responder(`/${slugDoCookie}/minha-conta`);
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      const slugDoCadastro = slugValido(data.user?.user_metadata?.cliente_slug as string | undefined);
      return responder(slugDoCadastro ? `/${slugDoCadastro}/minha-conta` : "/");
    }
    console.error("[cortex-os] falha ao trocar código OAuth por sessão:", result.error);
  }

  return responder(slugDoCookie ? `/${slugDoCookie}/entrar?erro=retorno` : "/login");
}
