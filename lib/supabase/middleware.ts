import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const PRIVATE_ROOTS = [
  "/agenda", "/atendimento", "/clientes", "/configuracoes", "/inteligencia", "/materiais",
  "/produtos", "/profissionais", "/servicos", "/onboarding", "/caixa", "/estoque", "/vendas",
  "/comissoes", "/financeiro", "/dashboard", "/kpis", "/relatorios", "/pdv", "/mudar-senha-inicial",
];

function isPrivatePath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PRIVATE_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  if (!user && isPrivatePath(pathname)) {
    const url = request.nextUrl.clone(); url.pathname = "/login"; return NextResponse.redirect(url);
  }
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone(); url.pathname = "/"; return NextResponse.redirect(url);
  }

  // Profissionais têm o acesso operacional governado pelo registro de acesso,
  // não apenas pela existência de uma sessão no Supabase Auth.
  if (user && user.user_metadata?.account_type === "professional") {
    const { data: accesses } = await supabase
      .from("professional_access")
      .select("password_set_at, is_access_enabled, professional!inner(user_id)")
      .eq("professional.user_id", user.id);

    const access = accesses?.[0];

    // Uma sessão antiga não deve continuar válida depois que o acesso foi desativado.
    if (!access?.is_access_enabled) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "access_disabled");
      return NextResponse.redirect(url);
    }

    if (!access.password_set_at && pathname !== "/mudar-senha-inicial") {
      const url = request.nextUrl.clone();
      url.pathname = "/mudar-senha-inicial";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
