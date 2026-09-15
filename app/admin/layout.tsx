import type { ReactNode } from "react";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform-permissions";
import { Wordmark } from "@/components/ui/wordmark";
import { Vazio } from "@/components/ui/estado";
import { GlassSurface } from "@/components/ui/glass-surface";
import { ToastProvider } from "@/components/ui/toast";
import { AdminNavLinks } from "./AdminNavLinks";

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
          <div className="flex justify-center mb-8"><Wordmark tamanho="lg" /></div>
          <Vazio
            titulo="Acesso restrito"
            descricao="Esta área é exclusiva de quem administra a plataforma CORTEX.OS — pertencer a uma empresa como responsável ou gerente não dá acesso a ela."
            acao={
              <Link href="/" className="min-h-11 inline-flex items-center text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard">
                Voltar para o CORTEX.OS
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
            <div className="shell min-h-14 py-2 flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="flex w-full sm:w-auto items-center justify-between gap-4 shrink-0">
                <Link href="/admin" className="flex items-center gap-2 shrink-0">
                  <Wordmark tamanho="sm" className="text-shell-foreground" />
                  <span
                    className="text-caption uppercase tracking-[0.12em] text-shell-muted border-l pl-2"
                    style={{ borderColor: "var(--shell-border)" }}
                  >
                    Admin
                  </span>
                </Link>
                <Link href="/" className="sm:hidden min-h-11 inline-flex items-center text-caption text-shell-muted hover:text-shell-foreground">
                  Sair
                </Link>
              </div>

              <AdminNavLinks />

              <Link href="/" className="hidden sm:inline-flex ml-auto shrink-0 min-h-11 items-center text-caption text-shell-muted hover:text-shell-foreground transition-colors duration-fast ease-standard">
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
