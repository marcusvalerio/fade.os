import { addCalendarDays, businessToday } from "./time.ts";

export type PeriodPreset = "hoje" | "7dias" | "mes" | "personalizado";

/**
 * Os períodos analíticos são períodos da operação, não do relógio do
 * servidor.
 *
 * A versão anterior partia de `new Date()` com `setHours(0,0,0,0)` e depois
 * `toISOString().slice(0,10)` — duas conversões no fuso do runtime, que em
 * produção é UTC. Das 21:00 BRT em diante, "hoje" já era amanhã, e o mês
 * virava um dia antes.
 *
 * A aritmética aqui é de calendário puro (strings "YYYY-MM-DD"), então
 * atravessa virada de mês e de ano sem tocar em fuso. Quem decide qual é o
 * dia de hoje é `businessToday()`, o mesmo helper que a Agenda usa desde a
 * rodada 01.
 *
 * A outra metade da fronteira mora no banco: as funções de métrica rodam com
 * `SET timezone = 'America/Sao_Paulo'`, então o `created_at::date` lá dentro
 * recorta o dia no mesmo relógio que estas datas descrevem.
 */
export function resolvePeriod(
  preset: PeriodPreset,
  customStart?: string,
  customEnd?: string
): { start: string; end: string; previousStart: string; previousEnd: string } {
  const hoje = businessToday();

  let start: string;
  let end: string = hoje;

  if (preset === "hoje") {
    start = hoje;
  } else if (preset === "7dias") {
    start = addCalendarDays(hoje, -6);
  } else if (preset === "mes") {
    start = `${hoje.slice(0, 7)}-01`;
  } else {
    start = customStart || hoje;
    end = customEnd || hoje;
  }

  // Um período personalizado pode chegar invertido; ordena em vez de produzir
  // uma janela negativa que nenhuma consulta encontraria.
  if (start > end) [start, end] = [end, start];

  const dias = diasEntre(start, end);
  const previousEnd = addCalendarDays(start, -1);
  const previousStart = addCalendarDays(previousEnd, -(dias - 1));

  return { start, end, previousStart, previousEnd };
}

/** Quantos dias o intervalo cobre, contando as duas pontas. */
function diasEntre(start: string, end: string): number {
  const [ay, am, ad] = start.split("-").map(Number);
  const [by, bm, bd] = end.split("-").map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / 86400000) + 1;
}
