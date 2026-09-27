import { cn } from "@/lib/cn";

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

const MARCA: Record<HealthStatus, string> = {
  operational: "bg-success",
  degraded: "bg-warning",
  down: "bg-danger",
  unknown: "border border-border-strong",
  not_connected: "border border-border-strong",
};

/** Quadrado + palavra — sem pílula. O estado nunca depende só da cor. */
export function StatusIndicator({ status, detail }: { status: HealthStatus; detail?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-caption">
      <span aria-hidden className={cn("size-2 shrink-0", MARCA[status])} />
      <span className={status === "not_connected" || status === "unknown" ? "text-muted" : "text-foreground"}>{LABEL[status]}</span>
      {detail && <span className="text-muted mono">{detail}</span>}
    </span>
  );
}
