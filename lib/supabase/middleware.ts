import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const PRIVATE_ROOTS = [
  "/agenda", "/atendimento", "/clientes", "/configuracoes", "/inteligencia", "/materiais",
  "/produtos", "/profissionais", "/servicos", "/onboarding", "/caixa", "/estoque", "/vendas",
  "/comissoes", "/financeiro", "/dashboard", "/kpis", "/relatorios", "/pdv", "/mudar-senha-inicial",
  "/admin",
];

function isPrivatePath(pathname: string): boolean {
  return PRIVATE_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

function isAdminLoginPath(pathname: string): boolean {
  return pathname === "/admin/login";
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

  // /admin/login é público por desenho: a própria action autentica e valida
  // is_platform_admin antes de liberar a sessão administrativa.
  if (!user && isAdminLoginPath(pathname)) return supabaseResponse;

  if (!user && isPrivatePath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = isAdminLoginPath(pathname) ? "/admin/login" : "/login";
    return NextResponse.redirect(url);
  }
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: accesses } = await supabase
      .from("professional_access")
      .select("company_id, password_set_at, is_access_enabled, professional!inner(user_id)")
      .eq("professional.user_id", user.id);

    if (accesses && accesses.length > 0) {
      const { data: roleLinks } = await supabase
        .from("user_company_role")
        .select("company_id, role:role_id(key)")
        .eq("user_id", user.id);

      const managedCompanies = new Set(
        (roleLinks ?? [])
          .filter((link) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const key = (link.role as any)?.key;
            return key === "owner" || key === "admin";
          })
          .map((link) => link.company_id)
      );

      const governing = accesses.filter((access) => !managedCompanies.has(access.company_id));

      if (governing.length > 0) {
        if (governing.every((access) => !access.is_access_enabled)) {
          await supabase.auth.signOut();
          const url = request.nextUrl.clone();
          url.pathname = "/login";
          url.searchParams.set("error", "access_disabled");
          return NextResponse.redirect(url);
        }

        const pendingFirstAccess = governing.some(
          (access) => access.is_access_enabled && !access.password_set_at
        );

        if (pendingFirstAccess && pathname !== "/mudar-senha-inicial" && !isAdminLoginPath(pathname)) {
          const url = request.nextUrl.clone();
          url.pathname = "/mudar-senha-inicial";
          return NextResponse.redirect(url);
        }
      }
    }

    if (pathname !== "/mudar-senha-inicial" && !isAdminLoginPath(pathname)) {
      const { data: securityState } = await supabase
        .from("user_security_state")
        .select("must_change_password")
        .eq("user_id", user.id)
        .maybeSingle();

      if (securityState?.must_change_password) {
        const url = request.nextUrl.clone();
        url.pathname = "/mudar-senha-inicial";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
