import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { entrouPeloGoogle } from "@/lib/metodo-de-entrada";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const PRIVATE_ROOTS = [
  "/agenda", "/atendimento", "/clientes", "/configuracoes", "/inteligencia", "/materiais",
  "/produtos", "/profissionais", "/servicos", "/onboarding", "/caixa", "/estoque", "/vendas",
  "/comissoes", "/financeiro", "/dashboard", "/kpis", "/relatorios", "/pdv", "/mudar-senha-inicial",
  "/admin", "/ajuda",
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

  // A gestão entra só com e-mail e senha; o Google é da área do cliente
  // (/[slug]/entrar). Como o Supabase liga as formas de entrar pelo e-mail
  // verificado, alguém da equipe que use o Google ali recebe uma sessão da
  // mesma conta — ela não abre o produto interno, o onboarding nem o admin.
  // Quem é só cliente volta para a própria área; os demais saem desta sessão
  // (só dela) e voltam ao login.
  if (user && isPrivatePath(pathname) && !isAdminLoginPath(pathname)) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && entrouPeloGoogle(session.access_token)) {
      const url = request.nextUrl.clone();
      url.search = "";
      const { count } = await supabase
        .from("user_company_role")
        .select("company_id", { count: "exact", head: true })
        .eq("user_id", user.id);
      const { data: barbearias } = count
        ? { data: null }
        : await supabase.rpc("get_my_client_barbershops");
      const primeira = (barbearias as { slug: string }[] | null)?.[0];
      if (primeira) {
        url.pathname = `/${primeira.slug}/minha-conta`;
      } else {
        await supabase.auth.signOut({ scope: "local" });
        url.pathname = "/login";
        url.searchParams.set("error", "metodo");
      }
      const resposta = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach((cookie) => resposta.cookies.set(cookie));
      return resposta;
    }
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
