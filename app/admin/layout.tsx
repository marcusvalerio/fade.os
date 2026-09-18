import type { ReactNode } from "react";
import Link from "next/link";
import { getSessionUser } from "@/lib/tenancy";
import { requirePlatformAdmin } from "@/lib/platform-permissions";
import { Wordmark } from "@/components/ui/wordmark";
import { Vazio } from "@/components/ui/estado";
import { GlassSurface } from "@/components/ui/glass-surface";
import { ToastProvider } from "@/components/ui/toast";
import { AdminNavLinks } from "./AdminNavLinks";

/**
 * CORTEX ADMIN — camada de plataforma, acima das empresas.
 *
 * /admin/login fica dentro do segmento /admin para manter a URL coesa, mas
 * não entra no shell protegido quando não existe sessão. Depois do login,
 * requirePlatformAdmin() continua sendo o gate real e cada Server Action
 * continua fazendo sua própria checagem.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  // ARCH 2: reaproveita o seam já memoizado de lib/tenancy.ts em vez de
  // chamar supabase.auth.getUser() de novo.
  const user = await getSessionUser();

  // A única rota pública do segmento é /admin/login. O middleware já garante
  // que outras rotas /admin não chegam aqui sem sessão.
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
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-[var(--z-header)]">
          <GlassSurface as="header" tone="shell">
            <div className="shell min-h-14 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link href="/admin" className="flex items-center gap-2 shrink-0">
                <Wordmark tamanho="sm" className="text-shell-foreground" />
                <span
                  className="text-caption uppercase tracking-[0.12em] text-shell-muted border-l pl-2"
                  style={{ borderColor: "var(--shell-border)" }}
                >
                  Admin
                </span>
              </Link>
              <AdminNavLinks />
              <Link
                href="/"
                className="ml-auto shrink-0 text-caption text-shell-muted hover:text-shell-foreground transition-colors duration-fast ease-standard"
              >
                Voltar ao CORTEX.OS
              </Link>
            </div>
          </GlassSurface>
        </div>
        <main className="shell py-6 sm:py-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
