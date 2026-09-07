import Link from "next/link";
import { getCurrentCompany } from "@/lib/current-company";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { isCompanyManager } from "@/lib/permissions";
import { fetchDashboardComparison, type PeriodPreset } from "@/actions/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatMinutes } from "@/lib/format";
import { PeriodPicker } from "../dashboard/PeriodPicker";
import { PrintButton } from "./PrintButton";

const PRESET_LABEL: Record<string, string> = {
  hoje: "Relatório diário",
  "7dias": "Relatório semanal",
  mes: "Relatório mensal",
};

/**
 * Mesma camada de consolidação do Dashboard/KPIs (seção 19: "os relatórios
 * devem utilizar a mesma camada consolidada... não criar um cálculo
 * separado apenas para o PDF"). "Gerar PDF" usa a impressão do navegador
 * (window.print, em PrintButton) em vez de uma biblioteca de PDF que não
 * existe no projeto — real e funcional, sem inventar uma integração.
 */
export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo } = await searchParams;
  const preset = (periodo as PeriodPreset) ?? "7dias";
  const current = await getCurrentCompany();
  const companyId = current!.company.id;

  const user = await requireAuthenticatedUser();
  if (!(await isCompanyManager(companyId, user.id))) {
    return (
      <div>
        <PageHeader title="Relatórios" />
        <EmptyState
          title="Acesso restrito"
          description="Esta área é visível apenas para o responsável e gerentes da empresa."
        />
      </div>
    );
  }

  const { current: metrics, period } = await fetchDashboardComparison(companyId, null, preset);

  if (!metrics) {
    return (
      <div>
        <PageHeader title="Relatórios" />
        <p className="text-body-sm text-muted">Não foi possível carregar o relatório agora.</p>
      </div>
    );
  }

  const ocupacaoPct =
    metrics.ocupacao_planejada_minutos > 0
      ? Math.round((metrics.ocupacao_real_minutos / metrics.ocupacao_planejada_minutos) * 100)
      : null;

  const rows: [string, string][] = [
    ["Faturamento", formatCurrency(metrics.faturamento)],
    ["Receita recebida", formatCurrency(metrics.receita_recebida)],
    ["Estornos", formatCurrency(metrics.estornos)],
    ["Ticket médio", formatCurrency(metrics.ticket_medio)],
    ["Atendimentos", String(metrics.atendimentos_count)],
    ["Clientes novos", String(metrics.clientes_novos)],
    ["Clientes recorrentes", String(metrics.clientes_recorrentes)],
    ["Cancelamentos", String(metrics.cancelamentos_count)],
    ["No-show", String(metrics.no_show_count)],
    ["Ocupação real", ocupacaoPct !== null ? `${ocupacaoPct}%` : "sem jornada configurada"],
    ["Tempo atendido", formatMinutes(Math.round(metrics.ocupacao_real_minutos))],
    ["Comissões geradas", formatCurrency(metrics.comissoes_total)],
    ["Estoque crítico", `${metrics.estoque_critico_count} item(ns)`],
  ];

  return (
    <div className="max-w-xl space-y-6 print:max-w-none">
      <PageHeader
        title="Relatórios"
        description={`${PRESET_LABEL[preset] ?? "Relatório"} · ${period.start} a ${period.end}`}
        action={
          <div className="flex items-center gap-2 print:hidden">
            <Link href="/kpis" className="text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard mr-2">
              Ver KPIs
            </Link>
            <PeriodPicker current={preset} />
            <PrintButton />
          </div>
        }
      />

      <div className="rounded-md border border-border bg-surface divide-y divide-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-4 py-3">
            <span className="text-body-sm text-muted">{label}</span>
            <span className="text-body-sm font-medium text-foreground tabular-nums">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
