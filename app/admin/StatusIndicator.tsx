import { Badge } from "@/components/ui/badge";

/**
 * Vocabulário único de status de saúde, usado em System Health e em
 * qualquer outro lugar que precise dizer "isso está de pé ou não" sem
 * inventar um quinto estado. NOT_CONNECTED existe porque fingir
 * OPERATIONAL para um serviço que não tem integração nenhuma (Sentry,
 * Stripe, webhooks, jobs) seria exatamente o dado fabricado que a tarefa
 * proíbe — é sempre honesto sobre "não sei" vs. "sei que está ok".
 */
export type HealthStatus = "operational" | "degraded" | "down" | "unknown" | "not_connected";

const LABEL: Record<HealthStatus, string> = {
  operational: "Operacional",
  degraded: "Degradado",
  down: "Fora do ar",
  unknown: "Desconhecido",
  not_connected: "Não conectado",
};

const TONE: Record<HealthStatus, "success" | "warning" | "danger" | "neutral"> = {
  operational: "success",
  degraded: "warning",
  down: "danger",
  unknown: "neutral",
  not_connected: "neutral",
};

export function StatusIndicator({ status, detail }: { status: HealthStatus; detail?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Badge tone={TONE[status]}>{LABEL[status]}</Badge>
      {detail && <span className="text-caption text-muted">{detail}</span>}
    </span>
  );
}
