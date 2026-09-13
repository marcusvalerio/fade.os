import type { ReactNode } from "react";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform-permissions";
import { Wordmark } from "@/components/ui/wordmark";
import { Vazio } from "@/components/ui/estado";
import { GlassSurface } from "@/components/ui/glass-surface";
import { AdminNavLinks } from "./AdminNavLinks";

/**
 * CORTEX ADMIN — camada de plataforma, acima das empresas.
 *
 * Este layout é o gate real: se `requirePlatformAdmin()` falhar, nenhuma
 * página abaixo dele chega a renderizar — não é "esconder o menu", é o
 * conteúdo administrativo nunca sendo buscado. Cada Server Action chamada
 * a partir daqui (actions/platform-admin.ts, actions/beta.ts) checa de novo
 * por conta própria, porque um endpoint HTTP não sabe que passou por este
 * layout.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
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
            descricao="Esta área é exclusiva de quem administra a plataforma CORTEX.OS — pertencer a uma empresa como responsável ou gerente não dá acesso a ela."
            acao={
              <Link
                href="/"
                className="min-h-11 inline-flex items-center text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard"
              >
                Voltar para o CORTEX.OS
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-[var(--z-header)]">
        <GlassSurface as="header" tone="shell">
          <div className="shell h-14 flex items-center gap-6">
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
      <main className="shell py-8">{children}</main>
    </div>
  );
}
