import type { ReactNode } from "react";
import Link from "next/link";
import { getSessionUser } from "@/lib/tenancy";
import { requirePlatformAdmin } from "@/lib/platform-permissions";
import { signOut } from "@/actions/auth";
import { Wordmark } from "@/components/ui/wordmark";
import { Vazio } from "@/components/ui/estado";
import { GlassSurface } from "@/components/ui/glass-surface";
import { ToastProvider } from "@/components/ui/toast";
import { AdminSidebarNav, AdminMobileNav } from "./AdminNavLinks";

/**
 * CORTEX ADMIN — superfície de plataforma, deliberadamente distinta do
 * shell operacional das barbearias (app/(app)/layout.tsx): sem nome de
 * empresa, sem trocador de unidade, sem os módulos do produto. Uma
 * sidebar própria (desktop/tablet) + seletor (mobile) — nunca as duas
 * juntas — comunica "isto é outra coisa" sem inventar uma segunda
 * linguagem visual: mesmos tokens, GlassSurface e Wordmark do produto.
 *
 * /admin/login fica dentro do segmento /admin para manter a URL coesa,
 * mas não entra neste shell quando não existe sessão nenhuma.
 * requirePlatformAdmin() é o gate real, e cada Server Action em
 * actions/platform-admin.ts/platform-auth.ts checa de novo — esconder a
 * navegação nunca é a proteção.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  // A única rota pública do segmento é /admin/login. O middleware já
  // garante que outras rotas /admin não chegam aqui sem sessão.
  if (!user) return children;

  let autorizado = true;
  try {
    await requirePlatformAdmin();
  } catch {
    autorizado = false;
  }

  if (!autorizado) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm">
          <div className="flex justify-center mb-8">
            <Wordmark tamanho="lg" />
          </div>
          <Vazio
            titulo="Acesso restrito"
            descricao="Esta área é exclusiva da administração da plataforma. O acesso de uma empresa, gerência ou profissional não concede acesso ao CORTEX ADMIN."
            acao={
              <Link
                href="/admin/login"
                className="min-h-11 inline-flex items-center text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard"
              >
                Entrar com outra conta
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background lg:flex">
        <aside
          className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto"
          style={{ background: "var(--shell-surface)", borderRight: "1px solid var(--shell-border)" }}
        >
          <div className="px-3 pt-5 pb-4" style={{ borderBottom: "1px solid var(--shell-border)" }}>
            <Link href="/admin" className="flex items-center gap-2 px-3">
              <Wordmark tamanho="sm" className="text-shell-foreground" />
              <span className="text-caption uppercase tracking-label text-shell-muted border-l pl-2 border-shell-border">
                Admin
              </span>
            </Link>
          </div>
          <div className="flex-1 px-3 py-4">
            <AdminSidebarNav />
          </div>
          <div className="px-3 py-4" style={{ borderTop: "1px solid var(--shell-border)" }}>
            <p className="text-caption text-shell-muted truncate px-3">{user.email}</p>
            <div className="flex flex-col gap-0.5 mt-1">
              <Link href="/" className="text-caption px-3 py-1.5 rounded-sm text-shell-muted hover:text-shell-foreground transition-colors duration-fast ease-standard">
                Voltar ao CORTEX.OS
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="w-full text-left text-caption px-3 py-1.5 rounded-sm text-shell-muted hover:text-shell-foreground transition-colors duration-fast ease-standard"
                >
                  Sair
                </button>
              </form>
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="sticky top-0 z-[var(--z-header)] lg:hidden">
            <GlassSurface as="header" tone="shell">
              <div className="shell min-h-14 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                <Link href="/admin" className="flex items-center gap-2 shrink-0">
                  <Wordmark tamanho="sm" className="text-shell-foreground" />
                  <span
                    className="text-caption uppercase tracking-label text-shell-muted border-l pl-2 border-shell-border"
                  >
                    Admin
                  </span>
                </Link>
                <Link href="/" className="ml-auto shrink-0 text-caption text-shell-muted hover:text-shell-foreground transition-colors duration-fast ease-standard">
                  Voltar
                </Link>
                <div className="order-3 w-full">
                  <AdminMobileNav />
                </div>
              </div>
            </GlassSurface>
          </div>
          <main className="shell lg:max-w-none py-6 sm:py-8 lg:px-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
