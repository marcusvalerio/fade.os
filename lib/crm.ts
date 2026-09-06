import { createClient } from "@/lib/supabase/server";
import type { ClientStatus } from "@/lib/types";

export type ClientBehavior = {
  clientId: string;
  visitCount: number;
  lastVisit: string | null;
  avgGapDays: number | null;
  daysSinceVisit: number | null;
  status: ClientStatus;
};

/**
 * Estado comportamental por CLIENTE, nunca por regra genérica tipo "duas
 * mensagens ignoradas" (seção 11 é explícita sobre isso). Compara o
 * intervalo real desse cliente com ele mesmo — um cliente que sempre volta
 * a cada 60 dias não fica "em recuperação" aos 35 dias só porque outro
 * cliente costuma voltar a cada 20.
 *
 * Sem histórico suficiente (0 ou 1 visita), o cliente é tratado como
 * "ativo" por padrão — não há dado pra classificar como qualquer outra
 * coisa, e "recém-chegado" não é um problema comportamental.
 */
function classify(avgGapDays: number | null, daysSinceVisit: number | null): ClientStatus {
  if (avgGapDays === null || daysSinceVisit === null) return "ativo";
  const ratio = daysSinceVisit / avgGapDays;
  if (ratio <= 1.5) return "ativo";
  if (ratio <= 2.5) return "atencao";
  if (ratio <= 4) return "recuperacao";
  return "inativo";
}

export async function getClientBehaviors(companyId: string): Promise<Map<string, ClientBehavior>> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("attendance")
    .select("client_id, created_at")
    .eq("company_id", companyId)
    .eq("status", "completed")
    .order("created_at", { ascending: true });

  const byClient = new Map<string, number[]>();
  (data ?? []).forEach((row) => {
    const visits = byClient.get(row.client_id) ?? [];
    visits.push(new Date(row.created_at).getTime());
    byClient.set(row.client_id, visits);
  });

  const now = Date.now();
  const dayMs = 1000 * 60 * 60 * 24;
  const result = new Map<string, ClientBehavior>();

  byClient.forEach((visits, clientId) => {
    const lastVisitMs = visits[visits.length - 1];
    const daysSinceVisit = Math.round((now - lastVisitMs) / dayMs);

    let avgGapDays: number | null = null;
    if (visits.length >= 2) {
      const gaps = visits.slice(1).map((t, i) => (t - visits[i]) / dayMs);
      avgGapDays = Math.round(gaps.reduce((sum, g) => sum + g, 0) / gaps.length) || 1;
    }

    result.set(clientId, {
      clientId,
      visitCount: visits.length,
      lastVisit: new Date(lastVisitMs).toISOString(),
      avgGapDays,
      daysSinceVisit,
      status: classify(avgGapDays, daysSinceVisit),
    });
  });

  return result;
}
