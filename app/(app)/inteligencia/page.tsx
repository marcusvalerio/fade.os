import Link from "next/link";
import { getCurrentCompany } from "@/lib/current-company";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { isCompanyManager, getOwnProfessionalId } from "@/lib/permissions";
import {
  getReturnInsights,
  getOvertimeInsights,
  getDurationTrendInsights,
  type Confidence,
} from "@/lib/insights";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  informacao: "informação",
  estimativa_inicial: "estimativa inicial",
  alerta_confiavel: "alerta confiável",
  recomendacao: "recomendação",
};

const CONFIDENCE_TONE: Record<Confidence, "neutral" | "info" | "warning"> = {
  informacao: "neutral",
  estimativa_inicial: "neutral",
  alerta_confiavel: "info",
  recomendacao: "warning",
};

export default async function InteligenciaPage() {
  const current = await getCurrentCompany();
  const companyId = current!.company.id;
  const user = await requireAuthenticatedUser();

  const manager = await isCompanyManager(companyId, user.id);
  const ownProfessionalId = manager ? null : await getOwnProfessionalId(companyId, user.id);

  if (!manager && !ownProfessionalId) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Central" />
        <EmptyState
          title="Nenhum perfil de profissional vinculado"
          description="Sua conta ainda não está ligada a um profissional desta empresa."
        />
      </div>
    );
  }

  // Central do Barbeiro (seção 17): mesmo motor de insights, mas escopado
  // ao próprio profissional — nunca comparação com outros ("minha
  // performance", não "quem está ganhando de quem").
  if (!manager && ownProfessionalId) {
    const durationInsights = await getDurationTrendInsights(companyId, ownProfessionalId);

    return (
      <div className="max-w-2xl space-y-8">
        <PageHeader
          title="Minha Central"
          description="Sua performance real, a partir dos seus próprios atendimentos — nunca comparada com outros profissionais."
        />

        {durationInsights.length === 0 ? (
          <Surface>
            <EmptyState
              title="Nada para destacar agora"
              description="Assim que houver histórico suficiente dos seus atendimentos, sua evolução de tempo por serviço aparece aqui."
            />
          </Surface>
        ) : (
          <section>
            <h2 className="text-section-title text-foreground mb-3">Minha duração por serviço</h2>
            <Surface>
              {durationInsights.map((i) => (
                <SurfaceRow key={i.serviceId} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-body-sm font-medium text-foreground">{i.serviceName}</p>
                    <Badge tone={CONFIDENCE_TONE[i.confidence]}>{CONFIDENCE_LABEL[i.confidence]}</Badge>
                  </div>
                  <p className="text-body-sm text-muted">
                    Esta semana: {i.avgThisWeek} min
                    {i.avgLastWeek !== null && ` · Semana passada: ${i.avgLastWeek} min`}
                    {i.vsLastWeekPct !== null && ` · Variação: ${i.vsLastWeekPct > 0 ? "+" : ""}${i.vsLastWeekPct}%`}
                  </p>
                  <p className="text-caption text-muted">
                    Configurado: {i.configuredMinutes} min ({i.vsConfiguredPct > 0 ? "+" : ""}
                    {i.vsConfiguredPct}%) · {i.sampleThisWeek} atendimento(s) esta semana
                  </p>
                </SurfaceRow>
              ))}
            </Surface>
          </section>
        )}
      </div>
    );
  }

  const [returnInsights, overtimeInsights, durationInsights] = await Promise.all([
    getReturnInsights(companyId),
    getOvertimeInsights(companyId),
    getDurationTrendInsights(companyId),
  ]);

  const hasAny = returnInsights.length > 0 || overtimeInsights.length > 0 || durationInsights.length > 0;

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

      {durationInsights.length > 0 && (
        <section>
          <h2 className="text-section-title text-foreground mb-3">Duração dos serviços</h2>
          <Surface>
            {durationInsights.map((i) => (
              <SurfaceRow key={i.serviceId} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-body-sm font-medium text-foreground">{i.serviceName}</p>
                  <Badge tone={CONFIDENCE_TONE[i.confidence]}>{CONFIDENCE_LABEL[i.confidence]}</Badge>
                </div>
                <p className="text-body-sm text-foreground">
                  Tempo médio de {i.serviceName} = {i.avgThisWeek} min. Configurado: {i.configuredMinutes} min
                  {i.avgLastWeek !== null && ` · Semana anterior: ${i.avgLastWeek} min`}.
                </p>
                <p className="text-caption text-muted">
                  {i.vsConfiguredPct > 0 ? "+" : ""}
                  {i.vsConfiguredPct}% vs. configurado
                  {i.vsLastWeekPct !== null && ` · ${i.vsLastWeekPct > 0 ? "+" : ""}${i.vsLastWeekPct}% vs. semana anterior`}
                  {" · "}
                  {i.sampleThisWeek} atendimento(s) esta semana
                </p>
                {i.confidence === "recomendacao" && (
                  <p className="text-caption text-signal-foreground bg-signal/20 rounded-sm px-2 py-1 inline-block">
                    Recomendação: revisar a duração configurada do serviço.
                  </p>
                )}
              </SurfaceRow>
            ))}
          </Surface>
        </section>
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
