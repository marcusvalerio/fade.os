import { createClient } from "@/lib/supabase/server";

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
