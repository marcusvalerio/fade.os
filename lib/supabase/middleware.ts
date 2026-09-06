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

  // Profissionais têm o acesso operacional governado pelo vínculo real
  // (professional.user_id = auth.uid()) e pelo registro correspondente em
  // professional_access — nunca por user_metadata, que é editável pelo
  // próprio usuário autenticado via supabase.auth.updateUser() no cliente.
  // Depender de account_type aqui permitiria que um profissional com acesso
  // desativado apagasse essa marca e escapasse deste bloqueio indefinidamente.
  if (user) {
    const { data: accesses } = await supabase
      .from("professional_access")
      .select("company_id, password_set_at, is_access_enabled, professional!inner(user_id)")
      .eq("professional.user_id", user.id);

    // Um mesmo usuário de auth nunca deveria estar ligado a mais de um
    // registro de professional_access (cada conta profissional pertence a
    // um único professional). Se isso acontecer, é um estado inconsistente
    // — nunca escolher um registro arbitrariamente com [0], pois isso
    // poderia liberar acesso com base no registro errado. Falha fechada.
    if (accesses && accesses.length > 1) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "access_disabled");
      return NextResponse.redirect(url);
    }

    const access = accesses?.[0];

    if (access && (!access.is_access_enabled || !access.password_set_at)) {
      // Um usuário pode ser owner/admin da empresa E também ter um registro
      // de profissional (ex.: dono que também atende). Nesse caso o acesso
      // dele já é governado pelo papel administrativo, e desativar ou
      // resetar o registro de profissional não pode derrubar o login
      // administrativo — só quem depende exclusivamente do acesso de
      // profissional é afetado pelas regras abaixo.
      const { data: isManager } = await supabase.rpc("has_company_management_access", {
        p_company_id: access.company_id,
      });

      if (!isManager) {
        // Uma sessão antiga não deve continuar válida depois que o acesso foi desativado.
        if (!access.is_access_enabled) {
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
    }
  }

  return supabaseResponse;
}
