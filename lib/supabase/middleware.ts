import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// FADE OS separa plataforma (autenticada) de barbearia pública (seção 4 da
// Fase 3): só estas raízes exigem sessão administrativa. Qualquer outro
// caminho — em especial /{slug} e /{slug}/agendar, que são dinâmicos e não
// dá para listar aqui — é público por padrão. A resolução real de "essa
// barbearia existe?" acontece depois, via slug → company nas próprias
// rotas, nunca aqui no middleware.
const PRIVATE_ROOTS = [
  "/agenda",
  "/atendimento",
  "/clientes",
  "/configuracoes",
  "/inteligencia",
  "/materiais",
  "/produtos",
  "/profissionais",
  "/servicos",
  "/onboarding",
  "/caixa",
  "/estoque",
  "/vendas",
  "/comissoes",
  "/financeiro",
  "/dashboard",
  "/kpis",
  "/relatorios",
];

function isPrivatePath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PRIVATE_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isPrivatePath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
