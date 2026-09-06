export type PeriodPreset = "hoje" | "7dias" | "mes" | "personalizado";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Datas [start,end] do período atual e do período anterior equivalente
 * (mesma duração, imediatamente antes) — usado para a comparação da
 * seção 14 ("esta semana vs. semana passada"). */
export function resolvePeriod(
  preset: PeriodPreset,
  customStart?: string,
  customEnd?: string
): { start: string; end: string; previousStart: string; previousEnd: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let start: Date;
  let end: Date = new Date(today);

  if (preset === "hoje") {
    start = new Date(today);
  } else if (preset === "7dias") {
    start = new Date(today);
    start.setDate(start.getDate() - 6);
  } else if (preset === "mes") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
  } else {
    start = customStart ? new Date(`${customStart}T00:00:00`) : new Date(today);
    end = customEnd ? new Date(`${customEnd}T00:00:00`) : new Date(today);
  }

  const spanDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - (spanDays - 1));

  return {
    start: isoDate(start),
    end: isoDate(end),
    previousStart: isoDate(previousStart),
    previousEnd: isoDate(previousEnd),
  };
}
