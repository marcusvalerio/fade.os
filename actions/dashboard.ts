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
