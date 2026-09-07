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

    if (accesses && accesses.length > 0) {
      // O acesso é 1:1 com o `professional`, não com o usuário de auth: a
      // mesma pessoa pode ser profissional em mais de uma empresa. Por isso
      // nunca se escolhe um registro por índice ([0]) nem se trata
      // length > 1 como corrupção — a decisão é tomada sobre o conjunto.
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

      // Um owner/admin que também atende (dono que corta cabelo) tem o acesso
      // governado pelo papel administrativo — desativar ou resetar o registro
      // de profissional dele não pode derrubar esse login. Só os vínculos em
      // empresas onde ele NÃO é gestor governam esta sessão.
      const governing = accesses.filter((access) => !managedCompanies.has(access.company_id));

      if (governing.length > 0) {
        // Sessão antiga não sobrevive à desativação. Só bloqueia quando
        // nenhum dos vínculos governantes está ativo — quem foi desativado
        // em uma empresa mas segue ativo em outra continua entrando.
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

        if (pendingFirstAccess && pathname !== "/mudar-senha-inicial") {
          const url = request.nextUrl.clone();
          url.pathname = "/mudar-senha-inicial";
          return NextResponse.redirect(url);
        }
      }
    }
  }

  return supabaseResponse;
}
