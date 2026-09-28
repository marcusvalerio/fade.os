import type { Metadata } from "next";
import Link from "next/link";
import { lerMinhasPreferencias } from "@/actions/notificacoes";
import { PreferenciasDeNotificacao } from "@/components/notificacoes/preferencias";

export const metadata: Metadata = { title: "Preferências de avisos" };

/**
 * O que o Admin pode desligar: só os avisos de Beta. Incidente, falha de
 * push/integração e segurança são essenciais — o banco recusa desligar.
 */
export default async function PreferenciasDaPlataformaPage() {
  const dados = await lerMinhasPreferencias();
  return (
    <div className="max-w-2xl space-y-8">
      <header className="animate-rise-in">
        <p className="eyebrow">Avisos</p>
        <h1 className="text-page-title text-foreground mt-2.5">Preferências.</h1>
        <p className="font-subtitle text-subtitle text-muted mt-2.5">
          Valem só para os avisos da plataforma. Os avisos de uma barbearia em que você também trabalha continuam nas configurações dela.
        </p>
        <p className="mt-3">
          <Link href="/admin/avisos" className="alvo-toque text-body-sm text-muted underline-offset-4 hover:text-foreground hover:underline">
            Ver avisos
          </Link>
        </p>
      </header>
      <PreferenciasDeNotificacao preferencias={dados.preferencias} ajuste={dados.ajuste} publicos={["plataforma"]} area="plataforma" />
    </div>
  );
}
