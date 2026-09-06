import { createClient } from "@/lib/supabase/server";

export type Confidence = "informacao" | "estimativa_inicial" | "alerta_confiavel" | "recomendacao";

export type DurationInsight = {
  serviceId: string;
  serviceName: string;
  configuredMinutes: number;
  avgThisWeek: number;
  avgLastWeek: number | null;
  sampleThisWeek: number;
  sampleLastWeek: number;
  vsConfiguredPct: number;
  vsLastWeekPct: number | null;
  confidence: Confidence;
};

export type ReturnInsight = {
  clientId: string;
  clientName: string;
  lastVisit: string;
  avgGapDays: number;
  daysSinceVisit: number;
};

export type OvertimeInsight = {
  itemId: string;
  professionalName: string;
  serviceName: string;
  overtimeMinutes: number;
};

/**
 * Clientes cuja última visita já passou do intervalo médio entre visitas
 * deles mesmos (não uma média genérica) — dado real derivado do histórico,
 * nunca uma previsão inventada.
 */
export async function getReturnInsights(companyId: string): Promise<ReturnInsight[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("attendance")
    .select("client_id, created_at, status, client:client_id(name)")
    .eq("company_id", companyId)
    .eq("status", "completed")
    .order("created_at", { ascending: true });

  if (!data) return [];

  const byClient = new Map<string, { name: string; visits: number[] }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (data as any[]).forEach((row) => {
    const entry = byClient.get(row.client_id) ?? {
      name: row.client?.name ?? "Cliente",
      visits: [] as number[],
    };
    entry.visits.push(new Date(row.created_at).getTime());
    byClient.set(row.client_id, entry);
  });

  const now = Date.now();
  const dayMs = 1000 * 60 * 60 * 24;
  const results: ReturnInsight[] = [];

  byClient.forEach((entry, clientId) => {
    if (entry.visits.length < 2) return;
    const gaps = entry.visits.slice(1).map((t, i) => (t - entry.visits[i]) / dayMs);
    const avgGap = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
    if (avgGap < 1) return;

    const lastVisit = entry.visits[entry.visits.length - 1];
    const daysSinceVisit = (now - lastVisit) / dayMs;

    if (daysSinceVisit >= avgGap * 0.9) {
      results.push({
        clientId,
        clientName: entry.name,
        lastVisit: new Date(lastVisit).toISOString(),
        avgGapDays: Math.round(avgGap),
        daysSinceVisit: Math.round(daysSinceVisit),
      });
    }
  });

  return results.sort((a, b) => b.daysSinceVisit / b.avgGapDays - a.daysSinceVisit / a.avgGapDays);
}

/**
 * Serviços em andamento agora, na empresa toda, que já passaram do tempo
 * planejado — mesmo sinal usado dentro do atendimento individual, aqui
 * agregado para quem olha a operação como um todo.
 */
export async function getOvertimeInsights(companyId: string): Promise<OvertimeInsight[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("attendance_item")
    .select(
      "id, started_at, planned_duration_minutes, professional:professional_id(name), service:service_id(name), attendance:attendance_id!inner(company_id, status)"
    )
    .is("ended_at", null)
    .not("started_at", "is", null)
    .eq("attendance.company_id", companyId)
    .eq("attendance.status", "in_progress");

  if (!data) return [];

  const now = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[])
    .map((item) => {
      const elapsedMinutes = (now - new Date(item.started_at).getTime()) / 60000;
      const overtimeMinutes = Math.round(elapsedMinutes - item.planned_duration_minutes);
      return {
        itemId: item.id,
        professionalName: item.professional?.name ?? "Profissional",
        serviceName: item.service?.name ?? "Serviço",
        overtimeMinutes,
      };
    })
    .filter((i) => i.overtimeMinutes > 5)
    .sort((a, b) => b.overtimeMinutes - a.overtimeMinutes);
}

/**
 * Duração real medida (started_at/ended_at) vs. duração configurada e vs.
 * a semana anterior — a "recomendação" da seção 16, com nível de
 * confiança explícito (seção 18) em vez de um insight solto sem dizer
 * quantos dados o sustentam. Nunca sugere alterar a configuração
 * sozinho — só relata o que aconteceu, a decisão continua humana.
 */
export async function getDurationTrendInsights(
  companyId: string,
  professionalId?: string
): Promise<DurationInsight[]> {
  const supabase = await createClient();

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const twoWeeksStart = new Date(now);
  twoWeeksStart.setDate(twoWeeksStart.getDate() - 14);

  let query = supabase
    .from("attendance_item")
    .select(
      "service_id, professional_id, started_at, ended_at, service:service_id(name, planned_duration_minutes), attendance:attendance_id!inner(company_id)"
    )
    .eq("kind", "service")
    .eq("attendance.company_id", companyId)
    .not("started_at", "is", null)
    .not("ended_at", "is", null)
    .gte("started_at", twoWeeksStart.toISOString());

  if (professionalId) query = query.eq("professional_id", professionalId);

  const { data } = await query;
  if (!data) return [];

  type Bucket = { name: string; configured: number; thisWeek: number[]; lastWeek: number[] };
  const byService = new Map<string, Bucket>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (data as any[]).forEach((item) => {
    if (!item.service) return;
    const durationMin = (new Date(item.ended_at).getTime() - new Date(item.started_at).getTime()) / 60000;
    const bucket: Bucket = byService.get(item.service_id) ?? {
      name: item.service.name,
      configured: item.service.planned_duration_minutes,
      thisWeek: [],
      lastWeek: [],
    };
    const startedAt = new Date(item.started_at);
    if (startedAt >= weekStart) bucket.thisWeek.push(durationMin);
    else bucket.lastWeek.push(durationMin);
    byService.set(item.service_id, bucket);
  });

  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;

  const results: DurationInsight[] = [];

  byService.forEach((bucket, serviceId) => {
    if (bucket.thisWeek.length === 0) return;

    const avgThisWeek = avg(bucket.thisWeek);
    const avgLastWeek = bucket.lastWeek.length > 0 ? avg(bucket.lastWeek) : null;
    const vsConfiguredPct = ((avgThisWeek - bucket.configured) / bucket.configured) * 100;
    const vsLastWeekPct = avgLastWeek !== null ? ((avgThisWeek - avgLastWeek) / avgLastWeek) * 100 : null;

    let confidence: Confidence = "informacao";
    if (bucket.thisWeek.length >= 3 && bucket.lastWeek.length >= 1) confidence = "alerta_confiavel";
    else if (bucket.thisWeek.length >= 2) confidence = "estimativa_inicial";

    const meaningfulVsConfigured = Math.abs(vsConfiguredPct) >= 15;
    const meaningfulVsLastWeek = vsLastWeekPct !== null && Math.abs(vsLastWeekPct) >= 10;

    if (confidence === "alerta_confiavel" && (meaningfulVsConfigured || meaningfulVsLastWeek)) {
      confidence = "recomendacao";
    }

    if (!meaningfulVsConfigured && !meaningfulVsLastWeek) return;

    results.push({
      serviceId,
      serviceName: bucket.name,
      configuredMinutes: bucket.configured,
      avgThisWeek: Math.round(avgThisWeek),
      avgLastWeek: avgLastWeek !== null ? Math.round(avgLastWeek) : null,
      sampleThisWeek: bucket.thisWeek.length,
      sampleLastWeek: bucket.lastWeek.length,
      vsConfiguredPct: Math.round(vsConfiguredPct * 10) / 10,
      vsLastWeekPct: vsLastWeekPct !== null ? Math.round(vsLastWeekPct * 10) / 10 : null,
      confidence,
    });
  });

  return results.sort((a, b) => Math.abs(b.vsConfiguredPct) - Math.abs(a.vsConfiguredPct));
}
