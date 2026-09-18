import Link from "next/link";
import { cn } from "@/lib/cn";
import { addCalendarDays } from "@/lib/time";

const WEEKDAY_ABBR = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

/** `date` já é um dia civil ("YYYY-MM-DD") — o dia da semana é aritmética de
 *  calendário pura, sem depender de fuso: não precisa passar por
 *  `businessInstant`/Intl para isso. */
function weekdayAbbr(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return WEEKDAY_ABBR[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

/**
 * Janela de 7 datas centrada na data selecionada (Bloco 1).
 *
 * Não é paginação por índice fixo nem uma grade semanal: a cada navegação a
 * janela é recalculada a partir de `selectedDate` (3 dias antes, ela, 3
 * depois), então continua correta partindo de qualquer dia — não só de
 * hoje. `‹`/`›` deslocam a janela inteira (7 dias) de uma vez; clicar numa
 * data troca o dia que a Agenda exibe, que continua sendo uma visão de um
 * único dia — só a forma de navegar até ele mudou.
 */
export function DateWindowNav({ selectedDate, today }: { selectedDate: string; today: string }) {
  const dates = Array.from({ length: 7 }, (_, i) => addCalendarDays(selectedDate, i - 3));

  return (
    <nav aria-label="Navegar por data" className="flex items-stretch gap-1 mb-3">
      <Link
        href={`/agenda?date=${addCalendarDays(selectedDate, -7)}`}
        aria-label="7 dias anteriores"
        className="alvo-toque shrink-0 inline-flex items-center justify-center w-8 rounded-sm text-muted hover:bg-surface-muted hover:text-foreground transition-colors duration-fast ease-standard"
      >
        <span aria-hidden="true">‹</span>
      </Link>

      <div className="flex-1 flex items-stretch gap-0.5 min-w-0">
        {dates.map((date) => {
          const isSelected = date === selectedDate;
          const isToday = date === today;
          return (
            <Link
              key={date}
              href={`/agenda?date=${date}`}
              aria-current={isSelected ? "date" : undefined}
              className={cn(
                "alvo-toque flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 rounded-sm py-1.5 transition-colors duration-fast ease-standard",
                isSelected ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-surface-muted"
              )}
            >
              <span
                className={cn(
                  "text-label uppercase truncate",
                  isSelected ? "text-primary-foreground" : "text-muted"
                )}
              >
                {weekdayAbbr(date)}
              </span>
              <span className="text-body-sm font-semibold tabular-nums leading-none">
                {date.slice(8, 10)}
              </span>
              {/* Indicação própria do dia atual — só quando ele não é o
                  selecionado, para não competir com o destaque de seleção. */}
              {isToday && !isSelected && (
                <span aria-hidden="true" className="size-1 rounded-full bg-accent" />
              )}
              {isToday && <span className="sr-only"> — hoje</span>}
            </Link>
          );
        })}
      </div>

      <Link
        href={`/agenda?date=${addCalendarDays(selectedDate, 7)}`}
        aria-label="7 dias seguintes"
        className="alvo-toque shrink-0 inline-flex items-center justify-center w-8 rounded-sm text-muted hover:bg-surface-muted hover:text-foreground transition-colors duration-fast ease-standard"
      >
        <span aria-hidden="true">›</span>
      </Link>
    </nav>
  );
}
