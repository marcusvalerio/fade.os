import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { isCompanyManager } from "@/lib/permissions";
import { fetchDashboardComparison, type PeriodPreset } from "@/actions/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatMinutes } from "@/lib/format";
import { PeriodPicker } from "../dashboard/PeriodPicker";
import Link from "next/link";

export default async function KpisPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo } = await searchParams;
  const preset = (periodo as PeriodPreset) ?? "7dias";
  const current = await getCurrentCompany();
  const companyId = current!.company.id;
  const supabase = await createClient();

  const user = await requireAuthenticatedUser();
  if (!(await isCompanyManager(companyId))) {
    return (
      <div>
        <PageHeader title="KPIs" />
        <EmptyState
          title="Acesso restrito"
          description="Esta área é visível apenas para o responsável e gerentes da empresa."
        />
      </div>
    );
  }

  const { current: metrics, previous, period } = await fetchDashboardComparison(companyId, null, preset);

  const { data: saleItems } = await supabase
    .from("sale_item")
    .select(
      "kind, quantity, total, professional:professional_id(id, name), product:product_id(id, name), sale:sale_id!inner(status, created_at)"
    )
    .eq("company_id", companyId)
    .eq("sale.status", "completed")
    .gte("sale.created_at", `${period.start}T00:00:00`)
    .lte("sale.created_at", `${period.end}T23:59:59`);

  const byProfessional = new Map<string, { name: string; count: number; total: number }>();
  const byProduct = new Map<string, { name: string; qty: number; total: number }>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (saleItems as any[] | null)?.forEach((item) => {
    if (item.kind === "service" && item.professional) {
      const entry = byProfessional.get(item.professional.id) ?? {
        name: item.professional.name,
        count: 0,
        total: 0,
      };
      entry.count += 1;
      entry.total += Number(item.total);
      byProfessional.set(item.professional.id, entry);
    }
    if (item.kind === "product" && item.product) {
      const entry = byProduct.get(item.product.id) ?? { name: item.product.name, qty: 0, total: 0 };
      entry.qty += Number(item.quantity);
      entry.total += Number(item.total);
      byProduct.set(item.product.id, entry);
    }
  });

  const professionals = Array.from(byProfessional.values()).sort((a, b) => b.total - a.total);
  const products = Array.from(byProduct.values()).sort((a, b) => b.qty - a.qty);

  if (!metrics) {
    return (
      <div>
        <PageHeader title="KPIs" />
        <p className="text-body-sm text-muted">Não foi possível carregar os indicadores agora.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="KPIs"
        description={`${period.start} a ${period.end}`}
        action={
          <div className="flex items-center gap-4">
            <Link href="/relatorios" className="text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard">
              Ver relatórios
            </Link>
            <PeriodPicker current={preset} />
          </div>
        }
      />

      <section>
        <h2 className="text-section-title text-foreground mb-3">Negócio</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Faturamento" value={formatCurrency(metrics.faturamento)} current={metrics.faturamento} previous={previous?.faturamento} />
          <MetricCard label="Receita recebida" value={formatCurrency(metrics.receita_recebida)} current={metrics.receita_recebida} previous={previous?.receita_recebida} />
          <MetricCard label="Ticket médio" value={formatCurrency(metrics.ticket_medio)} current={metrics.ticket_medio} previous={previous?.ticket_medio} />
          <MetricCard label="Comissões" value={formatCurrency(metrics.comissoes_total)} current={metrics.comissoes_total} previous={previous?.comissoes_total} />
        </div>
      </section>

      <section>
        <h2 className="text-section-title text-foreground mb-3">Operação</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Atendimentos" value={String(metrics.atendimentos_count)} current={metrics.atendimentos_count} previous={previous?.atendimentos_count} />
          <MetricCard
            label="Ocupação real"
            value={
              metrics.ocupacao_planejada_minutos > 0
                ? `${Math.round((metrics.ocupacao_real_minutos / metrics.ocupacao_planejada_minutos) * 100)}%`
                : "—"
            }
            current={metrics.ocupacao_real_minutos}
            context={formatMinutes(Math.round(metrics.ocupacao_real_minutos))}
          />
          <MetricCard label="Cancelamentos" value={String(metrics.cancelamentos_count)} current={metrics.cancelamentos_count} previous={previous?.cancelamentos_count} />
          <MetricCard label="No-show" value={String(metrics.no_show_count)} current={metrics.no_show_count} previous={previous?.no_show_count} />
        </div>
      </section>

      <section>
        <h2 className="text-section-title text-foreground mb-3">Clientes</h2>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Novos" value={String(metrics.clientes_novos)} current={metrics.clientes_novos} previous={previous?.clientes_novos} />
          <MetricCard label="Recorrentes" value={String(metrics.clientes_recorrentes)} current={metrics.clientes_recorrentes} previous={previous?.clientes_recorrentes} />
        </div>
      </section>

      <section>
        <h2 className="text-section-title text-foreground mb-3">Profissionais</h2>
        <Surface>
          {professionals.length > 0 ? (
            professionals.map((p) => (
              <SurfaceRow key={p.name} className="flex items-center justify-between">
                <span className="text-body-sm text-foreground">{p.name}</span>
                <span className="text-body-sm text-muted tabular-nums">
                  {p.count} atend. · {formatCurrency(p.total)}
                </span>
              </SurfaceRow>
            ))
          ) : (
            <EmptyState title="Sem vendas no período" description="Nenhum serviço vendido nesse intervalo." />
          )}
        </Surface>
      </section>

      <section>
        <h2 className="text-section-title text-foreground mb-3">Produtos</h2>
        <Surface>
          {products.length > 0 ? (
            products.map((p) => (
              <SurfaceRow key={p.name} className="flex items-center justify-between">
                <span className="text-body-sm text-foreground">{p.name}</span>
                <span className="text-body-sm text-muted tabular-nums">
                  {p.qty} un. · {formatCurrency(p.total)}
                </span>
              </SurfaceRow>
            ))
          ) : (
            <EmptyState title="Sem vendas no período" description="Nenhum produto vendido nesse intervalo." />
          )}
        </Surface>
      </section>
    </div>
  );
}
