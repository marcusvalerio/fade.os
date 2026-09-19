import { createClient } from "@/lib/supabase/server";
import type { HealthStatus } from "@/app/admin/StatusIndicator";

export type ServiceHealth = {
  service: string;
  status: HealthStatus;
  detail: string;
  checkedAt: string;
};

const DEGRADED_MS = 400;
const DOWN_MS = 1500;

function statusFromLatency(ms: number): HealthStatus {
  if (ms >= DOWN_MS) return "degraded";
  return "operational";
}

/**
 * Checagens reais, não simuladas — cada uma faz uma chamada de verdade e
 * mede o tempo. "Não conectado" é para os serviços que genuinamente não
 * têm integração nenhuma no código hoje (Storage/E-mail/Pagamentos/
 * Webhooks): mostrar "Operational" para eles seria inventar um dado que
 * a tarefa proíbe explicitamente. Se uma chamada real falhar, o status
 * vira "down" com o erro visível — nunca escondido atrás de "tudo bem".
 */
export async function checkPlatformHealth(): Promise<ServiceHealth[]> {
  const checkedAt = new Date().toISOString();
  const supabase = await createClient();

  const results: ServiceHealth[] = [
    {
      service: "API",
      status: "operational",
      detail: "Esta página renderizou no servidor Next.js agora — a API está respondendo.",
      checkedAt,
    },
  ];

  // Database: round-trip real contra uma tabela real, sem trazer linhas
  // (head: true) — mede só a latência de ida e volta ao Postgres.
  {
    const start = Date.now();
    const { error } = await supabase.from("platform_admin").select("user_id", { count: "exact", head: true });
    const ms = Date.now() - start;
    results.push({
      service: "Database",
      status: error ? "down" : statusFromLatency(ms),
      detail: error ? error.message : `${ms} ms`,
      checkedAt,
    });
  }

  // Authentication: round-trip real ao GoTrue (valida o JWT da sessão),
  // não uma leitura de cache local.
  {
    const start = Date.now();
    const { error } = await supabase.auth.getUser();
    const ms = Date.now() - start;
    results.push({
      service: "Authentication",
      status: error ? "down" : statusFromLatency(ms),
      detail: error ? error.message : `${ms} ms`,
      checkedAt,
    });
  }

  const notConnected: Array<{ service: string; detail: string }> = [
    { service: "Storage", detail: "Nenhum bucket/upload integrado no código hoje." },
    { service: "Email", detail: "Nenhum provedor de e-mail transacional integrado." },
    { service: "Payments", detail: "Nenhum provedor de pagamento (ex.: Stripe) integrado." },
    { service: "Webhooks", detail: "Nenhum endpoint de webhook inbound existe no código." },
  ];
  for (const item of notConnected) {
    results.push({ service: item.service, status: "not_connected", detail: item.detail, checkedAt });
  }

  return results;
}
