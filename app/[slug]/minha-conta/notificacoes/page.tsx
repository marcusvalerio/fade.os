import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/tenancy";
import { perfilDoCliente } from "@/actions/cliente";
import { lerMinhasPreferencias } from "@/actions/notificacoes";
import { PreferenciasDeNotificacao } from "@/components/notificacoes/preferencias";
import { Aviso } from "@/components/ui/estado";

export const metadata: Metadata = { title: "Notificações" };
export const dynamic = "force-dynamic";

/**
 * Preferências do cliente final: só o que vale para cliente (os próprios
 * horários, lembrete, pedido de avaliação, novidades se quiser). Nada da
 * operação da barbearia aparece aqui — o banco nem devolve.
 */
export default async function NotificacoesDoClientePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/${slug}/entrar`);
  const perfil = await perfilDoCliente(slug);
  if (!perfil.ok) {
    return (
      <div className="shell py-12">
        <div className="mx-auto max-w-lg">
          <Aviso tom="atencao" titulo="Não foi possível abrir a sua conta">
            {perfil.error}
          </Aviso>
        </div>
      </div>
    );
  }
  const dados = await lerMinhasPreferencias();

  return (
    <div className="shell py-10 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <Link href={`/${slug}/minha-conta`} className="alvo-toque text-body-sm text-muted hover:text-foreground">
          ← Meus horários
        </Link>
        <p className="eyebrow mt-6">{perfil.data.company_name}</p>
        <h1 className="text-page-title font-heading text-foreground mt-1">Notificações</h1>
        <p className="font-subtitle text-subtitle text-muted mt-2">Escolha o que a barbearia pode avisar você pelo CORTEX.</p>
        <div className="mt-8">
          <PreferenciasDeNotificacao preferencias={dados.preferencias} ajuste={dados.ajuste} publicos={["cliente"]} area="cliente" />
        </div>
      </div>
    </div>
  );
}
