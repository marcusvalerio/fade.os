import type { ReactNode } from "react";
import Link from "next/link";
import { getSessionUser } from "@/lib/tenancy";
import { requirePlatformAdmin } from "@/lib/platform-permissions";
import { signOut } from "@/actions/auth";
import { Wordmark } from "@/components/ui/wordmark";
import { Vazio } from "@/components/ui/estado";
import { ToastProvider } from "@/components/ui/toast";
import { FormularioSair } from "@/components/notificacoes/formulario-sair";
import { AdminSidebarNav, AdminMobileNav } from "./AdminNavLinks";
import { definirContexto } from "@/lib/observabilidade";
import { ContextoObservabilidade } from "@/components/contexto-observabilidade";

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
      <main className="admin-console min-h-screen flex items-center justify-center px-6">
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

  definirContexto({ usuarioId: user.id, empresaId: null, papel: "platform_admin", area: "admin" });

  return (
    <ToastProvider>
      <ContextoObservabilidade usuarioId={user.id} empresaId={null} papel="platform_admin" area="admin" />
      <div className="admin-console min-h-screen lg:flex">
        <aside className="hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto bg-shell-bg">
          <div className="px-5 h-15 flex items-center">
            <Link href="/admin" className="flex items-center gap-2.5">
              <Wordmark tamanho="sm" className="text-shell-foreground" />
              <span className="font-mono text-micro uppercase tracking-label text-shell-accent border border-shell-border rounded-xs px-1.5 py-0.5">
                admin
              </span>
            </Link>
          </div>
          <div className="flex-1 px-3 py-3">
            <AdminSidebarNav />
          </div>
          <div className="px-3 py-4 border-t border-shell-border">
            <p className="font-mono text-micro text-shell-muted truncate px-3">{user.email}</p>
            <div className="flex flex-col gap-px mt-2">
              <Link href="/" className="text-caption px-3 py-1.5 rounded-sm text-shell-muted hover:text-shell-foreground transition-colors duration-micro ease-standard">
                Voltar ao CORTEX.OS
              </Link>
              <FormularioSair acao={signOut}>
                <button
                  type="submit"
                  className="w-full text-left text-caption px-3 py-1.5 rounded-sm text-shell-muted hover:text-shell-foreground transition-colors duration-micro ease-standard"
                >
                  Sair
                </button>
              </FormularioSair>
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <header className="lg:hidden sticky top-0 z-[var(--z-header)] bg-shell-bg border-b border-shell-border">
            <div className="px-4 min-h-14 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link href="/admin" className="flex items-center gap-2 shrink-0">
                <Wordmark tamanho="sm" className="text-shell-foreground" />
                <span className="font-mono text-micro uppercase tracking-label text-shell-accent">admin</span>
              </Link>
              <Link href="/" className="ml-auto shrink-0 text-caption text-shell-muted hover:text-shell-foreground">
                Voltar
              </Link>
              <div className="order-3 w-full">
                <AdminMobileNav />
              </div>
            </div>
          </header>
          <main className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-[90rem]">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
