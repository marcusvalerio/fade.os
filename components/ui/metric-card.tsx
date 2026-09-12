/**
 * Um KPI nunca aparece sozinho (seção 15: "sempre mostrar valor, período,
 * comparação, contexto"). A comparação só é exibida quando o período
 * anterior tem dado real pra comparar (seção 14: "não mostrar comparação
 * quando não houver dados suficientes para que ela faça sentido") — nunca
 * "+Infinity%" ou uma variação inventada a partir de zero.
 */
export function metricDelta(current: number, previous: number | null): string | null {
  if (previous === null || previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  if (!Number.isFinite(pct)) return null;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function MetricCard({
  label,
  value,
  current,
  previous,
  context,
}: {
  label: string;
  value: string;
  current: number;
  previous?: number | null;
  context?: string;
}) {
  const delta = previous !== undefined ? metricDelta(current, previous ?? null) : null;
  const positive = delta?.startsWith("+");

  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <p className="text-label uppercase text-muted">{label}</p>
      <p className="text-metric text-foreground mt-1.5 tabular-nums">{value}</p>
      <div className="flex items-center gap-2 mt-1">
        {context && <p className="text-caption text-muted">{context}</p>}
        {delta && (
          <span className={`text-caption font-medium ${positive ? "text-success-ink" : "text-danger-ink"}`}>
            {delta} vs. período anterior
          </span>
        )}
      </div>
    </div>
  );
}
