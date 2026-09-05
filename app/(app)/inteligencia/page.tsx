import Link from "next/link";
import { getCurrentCompany } from "@/lib/current-company";
import { getReturnInsights, getOvertimeInsights } from "@/lib/insights";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";

export default async function InteligenciaPage() {
  const current = await getCurrentCompany();
  const companyId = current!.company.id;

  const [returnInsights, overtimeInsights] = await Promise.all([
    getReturnInsights(companyId),
    getOvertimeInsights(companyId),
  ]);

  const hasAny = returnInsights.length > 0 || overtimeInsights.length > 0;

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader
        title="Central de Inteligência"
        description="O que o FADE OS percebeu na sua operação — sempre a partir de dados reais, nunca uma estimativa genérica."
      />

      {!hasAny && (
        <Surface>
          <EmptyState
            title="Nada para destacar agora"
            description="Assim que houver histórico suficiente de atendimentos, observações como retorno de clientes e tempo de serviço aparecem aqui."
          />
        </Surface>
      )}

      {overtimeInsights.length > 0 && (
        <section>
          <h2 className="text-section-title text-foreground mb-3">Acontecendo agora</h2>
          <Surface>
            {overtimeInsights.map((i) => (
              <SurfaceRow key={i.itemId} className="border-l-2 border-signal">
                <p className="text-body-sm text-foreground">
                  <strong className="font-medium">{i.professionalName}</strong> está{" "}
                  <strong className="font-medium">{i.overtimeMinutes} min</strong> acima do tempo
                  previsto para {i.serviceName.toLowerCase()}.
                </p>
              </SurfaceRow>
            ))}
          </Surface>
        </section>
      )}

      {returnInsights.length > 0 && (
        <section>
          <h2 className="text-section-title text-foreground mb-3">Retorno de clientes</h2>
          <Surface>
            {returnInsights.slice(0, 12).map((i) => (
              <Link key={i.clientId} href={`/clientes/${i.clientId}`} className="block">
                <SurfaceRow className="flex items-center justify-between hover:bg-surface-muted">
                  <div>
                    <p className="text-body-sm font-medium text-foreground">{i.clientName}</p>
                    <p className="text-caption text-muted mt-0.5">
                      Costuma retornar a cada {i.avgGapDays} dias — já se passaram {i.daysSinceVisit}.
                    </p>
                  </div>
                </SurfaceRow>
              </Link>
            ))}
          </Surface>
        </section>
      )}
    </div>
  );
}
