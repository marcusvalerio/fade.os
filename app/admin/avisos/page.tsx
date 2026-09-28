import type { Metadata } from "next";
import Link from "next/link";
import { ListaDeNotificacoes } from "@/components/notificacoes/lista";
import { ConvitePush } from "@/components/notificacoes/convite-push";

export const metadata: Metadata = { title: "Avisos da plataforma" };

/**
 * Central do Admin: só o que pede ação (pedido de Beta, incidente, falha de
 * push/integração, segurança). Métricas e inatividade ficam em Saúde e
 * Alertas — nunca aqui. O banco só entrega esta área a platform_admin ativo.
 */
export default function AvisosDaPlataformaPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <header className="animate-rise-in">
        <p className="eyebrow">Plataforma</p>
        <h1 className="text-page-title text-foreground mt-2.5">Avisos.</h1>
        <p className="font-subtitle text-subtitle text-muted mt-2.5">
          Só o que pede uma ação sua. Indicadores e barbearias paradas ficam em{" "}
          <Link href="/admin/sistema" className="underline underline-offset-4 hover:text-foreground">
            Saúde
          </Link>
          .
        </p>
        <p className="mt-3">
          <Link href="/admin/avisos/preferencias" className="alvo-toque text-body-sm text-muted underline-offset-4 hover:text-foreground hover:underline">
            Preferências
          </Link>
        </p>
      </header>
      <ConvitePush publico="plataforma" />
      <section className="painel overflow-hidden">
        <ListaDeNotificacoes area="plataforma" empresaId={null} />
      </section>
    </div>
  );
}
