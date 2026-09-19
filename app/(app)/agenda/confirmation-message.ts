import { firstName } from "@/lib/whatsapp";
import { addCalendarDays } from "@/lib/time";

/**
 * "Aguardando confirmação" não é um status novo — é a leitura de
 * `appointment.status === 'scheduled'` (ainda não confirmado pela equipe,
 * ver docs/PUBLIC_BOOKING.md). Nenhuma coluna nova, nenhuma migration.
 */
/** `null` para qualquer dia além de hoje/amanhã — o chamador cai para
 *  formatBusinessDayLabel(selectedDate, ...) nesse caso. */
export function relativeDayLabel(selectedDate: string, today: string): string | null {
  if (selectedDate === today) return "hoje";
  if (selectedDate === addCalendarDays(today, 1)) return "amanhã";
  return null;
}

export function buildConfirmationMessage(params: {
  clientName: string;
  companyName: string;
  dayLabel: string;
  time: string;
  serviceName: string;
}): string {
  const primeiro = firstName(params.clientName);
  return (
    `Olá, ${primeiro}! Tudo bem?\n` +
    `Passando para confirmar seu horário na ${params.companyName} ${params.dayLabel} às ${params.time} para ${params.serviceName}.\n` +
    `Podemos confirmar seu atendimento?`
  );
}
