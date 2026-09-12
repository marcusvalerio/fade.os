import { cn } from "@/lib/cn";

/**
 * A grade de contadores rápidos — Agenda, Atendimento do profissional,
 * histórico do cliente. Três telas tinham essa mesma peça (hairline entre
 * tiles em vez de card por tile) escrita três vezes, com dois tamanhos de
 * número diferentes para o mesmo papel visual. Consolidada aqui: um só
 * componente, um só tamanho (text-metric — é a mesma pergunta glanceable
 * em toda tela que a usa), e a tinta de cada tom já corrigida para a
 * variante -ink (a cor da identidade é preenchimento, não texto solto).
 */
type StatTone = "neutral" | "signal" | "warning" | "success" | "danger";

const TONE_CLASS: Record<StatTone, string> = {
  neutral: "text-foreground bg-surface",
  signal: "text-signal-foreground bg-signal",
  warning: "text-warning-ink bg-surface",
  success: "text-success-ink bg-surface",
  danger: "text-danger-ink bg-surface",
};

export function StatGrid({
  children,
  className,
  columns = 4,
}: {
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3 | 4;
}) {
  const cols = columns === 2 ? "grid-cols-2" : columns === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4";
  return (
    <div className={cn("grid gap-px bg-border rounded-md overflow-hidden animate-rise-in", cols, className)}>
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: StatTone;
}) {
  return (
    <div className={cn("px-4 py-3.5", TONE_CLASS[tone])}>
      <p className="text-metric font-heading tabular-nums leading-none">{value}</p>
      <p className={cn("text-label uppercase mt-1.5", tone === "neutral" ? "text-muted" : "opacity-70")}>
        {label}
      </p>
    </div>
  );
}
