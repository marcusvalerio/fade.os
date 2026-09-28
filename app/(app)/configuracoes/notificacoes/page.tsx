import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentCompany } from "@/lib/current-company";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { getOwnProfessionalId } from "@/lib/permissions";
import { lerMinhasPreferencias } from "@/actions/notificacoes";
import { PageHeader } from "@/components/ui/page-header";
import { PreferenciasDeNotificacao } from "@/components/notificacoes/preferencias";
import type { Publico } from "@/lib/notificacoes/catalogo";

export const metadata: Metadata = { title: "Notificações" };

/**
 * Preferências de notificação de quem está logado (qualquer papel da
 * equipe). O que aparece depende do papel real nesta barbearia: dono e
 * gerência veem agenda, clientes, financeiro, estoque e equipe;
 * profissional vê a própria agenda, avaliações dos seus atendimentos e
 * comissões. O banco recusa qualquer preferência que não valha para a
 * pessoa, mesmo que alguém force pela API.
 */
export default async function PreferenciasDeNotificacaoPage() {
  const current = await getCurrentCompany();
  const user = await requireAuthenticatedUser();
  const [dados, profissionalId] = await Promise.all([lerMinhasPreferencias(), getOwnProfessionalId(current!.company.id, user.id)]);
  const gestor = current!.roleKey === "owner" || current!.roleKey === "admin";
  const publicos: Publico[] = [...(gestor ? (["gestor"] as const) : []), ...(profissionalId || !gestor ? (["profissional"] as const) : [])];

  return (
    <div className="max-w-2xl">
      <PageHeader
        eyebrow="Configurações"
        title="Notificações"
        description="Escolha o que o CORTEX pode avisar você."
        action={
          <Link href="/notificacoes" className="alvo-toque text-body-sm text-muted underline-offset-4 hover:text-foreground hover:underline">
            Ver notificações
          </Link>
        }
      />
      <PreferenciasDeNotificacao preferencias={dados.preferencias} ajuste={dados.ajuste} publicos={publicos} area="equipe" />
    </div>
  );
}
