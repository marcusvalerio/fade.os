import { checkPlatformHealth } from "@/lib/platform-health";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { StatusIndicator } from "../StatusIndicator";

/**
 * API/Database/Authentication são checagens reais (lib/platform-health.ts
 * — cada uma faz uma chamada de verdade e mede a latência agora, nesta
 * renderização). Storage/Email/Payments/Webhooks aparecem como "Não
 * conectado" porque genuinamente não há integração nenhuma com esses
 * serviços no código — nunca "Operational" fingido.
 */
export default async function AdminSystemHealthPage() {
  const health = await checkPlatformHealth();

  return (
    <div className="space-y-6">
      <PageHeader title="System Health" description="Estado dos serviços que sustentam a plataforma, agora." />

      <Surface>
        {health.map((s) => (
          <SurfaceRow key={s.service} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <div>
              <p className="text-body font-medium text-foreground">{s.service}</p>
              <p className="text-caption text-muted">{s.detail}</p>
            </div>
            <StatusIndicator status={s.status} />
          </SurfaceRow>
        ))}
      </Surface>

      <p className="text-caption text-muted">
        Verificado em {new Date(health[0]?.checkedAt ?? Date.now()).toLocaleString("pt-BR")}, no momento em
        que esta página foi carregada — não há monitoramento contínuo/histórico de disponibilidade ainda.
      </p>
    </div>
  );
}
