import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentCompany } from "@/lib/current-company";
import { PageHeader } from "@/components/ui/page-header";
import { ListaDeNotificacoes } from "@/components/notificacoes/lista";
import { ConvitePush } from "@/components/notificacoes/convite-push";

export const metadata: Metadata = { title: "Notificações" };

/** A central inteira: histórico, lidas e não lidas, desta barbearia e da plataforma. */
export default async function NotificacoesPage() {
  const current = await getCurrentCompany();
  return (
    <div className="max-w-2xl">
      <PageHeader
        eyebrow="Central"
        title="Notificações"
        description="O que pediu sua atenção. Toque para ir direto ao assunto."
        action={
          <Link
            href="/configuracoes/notificacoes"
            className="alvo-toque text-body-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            Preferências
          </Link>
        }
      />
      <ConvitePush publico="equipe" className="mb-6" />
      <ListaDeNotificacoes area="equipe" empresaId={current!.company.id} />
    </div>
  );
}
