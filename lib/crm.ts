import { createClient } from "@/lib/supabase/server";
import { comportamentoDoCliente, type ClientBehavior } from "@/lib/crm-regras";

export { comportamentoDoCliente, STATUS_CLIENTE, type ClientBehavior } from "@/lib/crm-regras";

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
  const result = new Map<string, ClientBehavior>();
  byClient.forEach((visits, clientId) => {
    result.set(clientId, comportamentoDoCliente(clientId, visits, now));
  });

  return result;
}
