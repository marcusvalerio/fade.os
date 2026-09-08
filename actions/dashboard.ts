"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCompanyAccess } from "@/lib/tenancy";
import { resolvePeriod, type PeriodPreset } from "@/lib/period";
import type { DashboardMetrics } from "@/lib/types";

export type { PeriodPreset };

export async function fetchDashboardMetrics(
  companyId: string,
  unitId: string | null,
  start: string,
  end: string
): Promise<DashboardMetrics | null> {
  await requireCompanyAccess(companyId);
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("get_dashboard_metrics", {
      p_company_id: companyId,
      p_unit_id: unitId,
      p_start: start,
      p_end: end,
    })
    .single();

  if (error || !data) return null;
  return data as DashboardMetrics;
}

export type SeriesPoint = {
  dia: string;
  faturamento: number;
  atendimentos: number;
  clientes_novos: number;
};

export type Breakdown = {
  servicos: { name: string; quantidade: number; receita: number }[];
  equipe: { name: string; atendimentos: number; receita: number }[];
};

/** Série diária do período — é o que o gráfico principal desenha. */
export async function fetchDashboardSeries(
  companyId: string,
  unitId: string | null,
  start: string,
  end: string
): Promise<SeriesPoint[]> {
  await requireCompanyAccess(companyId);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_dashboard_series", {
    p_company_id: companyId,
    p_unit_id: unitId,
    p_start: start,
    p_end: end,
  });

  if (error || !data) return [];
  return (data as SeriesPoint[]).map((point) => ({
    ...point,
    faturamento: Number(point.faturamento),
  }));
}

/** Serviços mais realizados e desempenho da equipe no período. */
export async function fetchDashboardBreakdown(
  companyId: string,
  unitId: string | null,
  start: string,
  end: string
): Promise<Breakdown> {
  await requireCompanyAccess(companyId);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_dashboard_breakdown", {
    p_company_id: companyId,
    p_unit_id: unitId,
    p_start: start,
    p_end: end,
  });

  if (error || !data) return { servicos: [], equipe: [] };
  return data as Breakdown;
}

export async function fetchDashboardComparison(
  companyId: string,
  unitId: string | null,
  preset: PeriodPreset,
  customStart?: string,
  customEnd?: string
): Promise<{
  current: DashboardMetrics | null;
  previous: DashboardMetrics | null;
  period: ReturnType<typeof resolvePeriod>;
}> {
  const period = resolvePeriod(preset, customStart, customEnd);
  const [current, previous] = await Promise.all([
    fetchDashboardMetrics(companyId, unitId, period.start, period.end),
    fetchDashboardMetrics(companyId, unitId, period.previousStart, period.previousEnd),
  ]);
  return { current, previous, period };
}
