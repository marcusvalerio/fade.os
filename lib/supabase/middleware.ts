import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { entrouPeloGoogle } from "@/lib/metodo-de-entrada";
import { CABECALHO_ROTA, ehRotaDoAdmin, ehRotaPublicaDoAdmin } from "@/lib/admin-entrada";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const PRIVATE_ROOTS = [
  "/agenda", "/atendimento", "/clientes", "/configuracoes", "/inteligencia", "/materiais",
  "/produtos", "/profissionais", "/servicos", "/onboarding", "/caixa", "/estoque", "/vendas",
  "/comissoes", "/financeiro", "/dashboard", "/kpis", "/relatorios", "/pdv", "/mudar-senha-inicial",
  "/admin", "/ajuda", "/notificacoes", "/pesquisa",
];

// O clique numa notificação push chega aqui também para clientes (que não
// entram por /login): a própria rota decide para onde mandar sem sessão.
const PUBLIC_EXCEPTIONS = ["/notificacoes/abrir/"];

function isPrivatePath(pathname: string): boolean {
  if (PUBLIC_EXCEPTIONS.some((p) => pathname.startsWith(p))) return false;
  return PRIVATE_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

function isAdminLoginPath(pathname: string): boolean {
  return pathname === "/admin/login";
}

// Um redirect que nasce depois de getUser() precisa levar os cookies que a
// renovação da sessão acabou de gravar, senão a próxima requisição chega com
// o token antigo.
function comCookies(resposta: NextResponse, origem: NextResponse): NextResponse {
  origem.cookies.getAll().forEach((cookie) => resposta.cookies.set(cookie));
  return resposta;
}

export async function updateSession(request: NextRequest) {
  // O layout do Admin precisa saber a rota para não vestir o console nas
  // telas de entrada (login e recuperação), que existem antes da autorização.
  request.headers.set(CABECALHO_ROTA, request.nextUrl.pathname);
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

  // CORTEX ADMIN. Entrada (login e recuperação) é pública por desenho: a
  // própria action autentica e valida is_platform_admin. Todo o resto exige
  // administrador de plataforma ATIVO antes de a página começar a carregar —
  // sem sessão vai para /admin/login (nunca /login); com sessão de quem não é
  // admin, também, com o aviso de acesso negado. O banco continua recusando
  // cada leitura por conta própria (funções admin_*); isto é a primeira
  // porta, não a única.
  //
  // PENDENTE — REQUER ACESSO AO SUPABASE: exigir aqui a sessão administrativa
  // própria (platform_admin_sessao, 8 h) em vez de só is_platform_admin, e
  // registrar o acesso negado em platform_audit_log.
  if (ehRotaDoAdmin(pathname)) {
    if (ehRotaPublicaDoAdmin(pathname)) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.search = "";
    url.pathname = "/admin/login";
    if (!user) {
      if (pathname !== "/admin") url.searchParams.set("proximo", pathname);
      return comCookies(NextResponse.redirect(url), supabaseResponse);
    }
    const { data: ehAdmin, error: erroAdmin } = await supabase.rpc("is_platform_admin");
    if (erroAdmin || ehAdmin !== true) {
      url.searchParams.set("acesso", "negado");
      return comCookies(NextResponse.redirect(url), supabaseResponse);
    }
  }

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
