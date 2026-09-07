import { getCurrentCompany } from "@/lib/current-company";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { isCompanyManager } from "@/lib/permissions";
import { fetchDashboardComparison, type PeriodPreset } from "@/actions/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatMinutes } from "@/lib/format";
import { PeriodPicker } from "./PeriodPicker";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo } = await searchParams;
  const preset = (periodo as PeriodPreset) ?? "7dias";
  const current = await getCurrentCompany();
  const companyId = current!.company.id;

  // Números do negócio: só o responsável/gerente vê. Esconder o link do menu
  // para recepção/profissional não impede acesso direto pela URL — a
  // barreira real precisa estar aqui, igual já é feito em Central/Comissões.
  const user = await requireAuthenticatedUser();
  if (!(await isCompanyManager(companyId))) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <EmptyState
          title="Acesso restrito"
          description="Esta área é visível apenas para o responsável e gerentes da empresa."
        />
      </div>
    );
  }

  const { current: metrics, previous, period } = await fetchDashboardComparison(companyId, null, preset);

  if (!metrics) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <p className="text-body-sm text-muted">Não foi possível carregar os indicadores agora.</p>
      </div>
    );
  }

  const ocupacaoPct =
    metrics.ocupacao_planejada_minutos > 0
      ? Math.round((metrics.ocupacao_real_minutos / metrics.ocupacao_planejada_minutos) * 100)
      : null;
  const ocupacaoPrevPct =
    previous && previous.ocupacao_planejada_minutos > 0
      ? Math.round((previous.ocupacao_real_minutos / previous.ocupacao_planejada_minutos) * 100)
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`${period.start} a ${period.end}`}
        action={<PeriodPicker current={preset} />}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Faturamento"
          value={formatCurrency(metrics.faturamento)}
          current={metrics.faturamento}
          previous={previous?.faturamento}
        />
        <MetricCard
          label="Receita recebida"
          value={formatCurrency(metrics.receita_recebida)}
          current={metrics.receita_recebida}
          previous={previous?.receita_recebida}
        />
        <MetricCard
          label="Ticket médio"
          value={formatCurrency(metrics.ticket_medio)}
          current={metrics.ticket_medio}
          previous={previous?.ticket_medio}
        />
        <MetricCard
          label="Atendimentos"
          value={String(metrics.atendimentos_count)}
          current={metrics.atendimentos_count}
          previous={previous?.atendimentos_count}
        />
        <MetricCard
          label="Clientes novos"
          value={String(metrics.clientes_novos)}
          current={metrics.clientes_novos}
          previous={previous?.clientes_novos}
        />
        <MetricCard
          label="Clientes recorrentes"
          value={String(metrics.clientes_recorrentes)}
          current={metrics.clientes_recorrentes}
          previous={previous?.clientes_recorrentes}
        />
        <MetricCard
          label="Ocupação real"
          value={ocupacaoPct !== null ? `${ocupacaoPct}%` : "sem jornada configurada"}
          current={ocupacaoPct ?? 0}
          previous={ocupacaoPrevPct}
          context={
            ocupacaoPct !== null
              ? `${formatMinutes(Math.round(metrics.ocupacao_real_minutos))} atendidos`
              : undefined
          }
        />
        <MetricCard
          label="Cancelamentos"
          value={String(metrics.cancelamentos_count)}
          current={metrics.cancelamentos_count}
          previous={previous?.cancelamentos_count}
        />
        <MetricCard
          label="No-show"
          value={String(metrics.no_show_count)}
          current={metrics.no_show_count}
          previous={previous?.no_show_count}
        />
        <MetricCard
          label="Comissões"
          value={formatCurrency(metrics.comissoes_total)}
          current={metrics.comissoes_total}
          previous={previous?.comissoes_total}
        />
        <MetricCard label="Caixa (saldo aberto)" value={formatCurrency(metrics.caixa_saldo_atual)} current={metrics.caixa_saldo_atual} />
        <MetricCard
          label="Estoque crítico"
          value={String(metrics.estoque_critico_count)}
          current={metrics.estoque_critico_count}
          context={metrics.estoque_critico_count > 0 ? "itens no ou abaixo do mínimo" : undefined}
        />
      </div>
    </div>
  );
}
