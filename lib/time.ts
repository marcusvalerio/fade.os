/**
 * O fuso operacional da barbearia.
 *
 * Regra do produto: quando alguém da barbearia digita 10:00, ou um cliente
 * escolhe 15:00 na página pública, os dois estão falando do relógio da
 * operação — nunca de UTC. UTC é só como o instante viaja e é guardado.
 *
 * O banco já sabia disso: `get_available_slots` e `assert_appointment_slot_valid`
 * ancoram `data + hora` neste mesmo fuso. O que faltava era a camada da
 * aplicação saber. Sem isto, `new Date("2026-09-22T10:00")` num servidor que
 * roda em UTC vira 10:00Z — isto é, 07:00 na barbearia — e
 * `toLocaleTimeString()` sem `timeZone` devolve o relógio do servidor, não o
 * da barbearia.
 *
 * Este módulo é a única porta entre os dois mundos. Nada aqui usa offset fixo
 * (“−3 horas”): tudo passa por `Intl` com o fuso nomeado, então continua
 * correto se o Brasil voltar a ter horário de verão ou se a operação um dia
 * mudar de fuso — basta trocar a constante abaixo (e a gêmea no SQL).
 */
export const BUSINESS_TIMEZONE = "America/Sao_Paulo";

const FIELDS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  timeZone: BUSINESS_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
});

type BusinessFields = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function toDate(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Instante inválido: ${String(value)}`);
  }
  return date;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Que horas este instante marca no relógio da barbearia. */
function businessFields(instant: Date): BusinessFields {
  const parts = FIELDS_FORMATTER.formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

/**
 * Quanto o fuso da barbearia estava adiantado/atrasado em relação a UTC
 * naquele instante. Lido do próprio `Intl`, nunca de uma constante — é isso
 * que faz a conversão sobreviver a mudanças de horário de verão.
 */
function businessOffsetMs(instant: Date): number {
  const f = businessFields(instant);
  const asIfUtc = Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, f.second);
  return asIfUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * O instante em que a barbearia marcará este horário de parede.
 * Aceita "2026-09-22T10:00", "2026-09-22T10:00:00" ou com espaço no lugar do T.
 *
 * É esta função — e não `new Date(...)` — que deve ler qualquer valor vindo de
 * um `<input type="datetime-local">`, porque esse input não carrega fuso
 * nenhum: ele diz "10:00", e "10:00" só significa alguma coisa em relação ao
 * relógio de quem digitou.
 */
export function businessInstant(localDateTime: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(
    localDateTime.trim()
  );
  if (!match) throw new Error(`Data e hora inválidas: "${localDateTime}"`);

  const [, year, month, day, hour, minute, second] = match;
  const wallClock = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    second ? Number(second) : 0
  );

  // Duas passagens: a primeira aplica o deslocamento vigente perto daquele
  // momento; a segunda corrige o caso em que o primeiro palpite caiu do outro
  // lado de uma virada de horário de verão.
  const firstGuess = wallClock - businessOffsetMs(new Date(wallClock));
  return new Date(wallClock - businessOffsetMs(new Date(firstGuess)));
}

/** O dia civil ("YYYY-MM-DD") em que este instante cai na barbearia. */
export function businessDate(value: string | Date): string {
  const f = businessFields(toDate(value));
  return `${f.year}-${pad(f.month)}-${pad(f.day)}`;
}

/** Hoje na barbearia — não no relógio do servidor. */
export function businessToday(now: Date = new Date()): string {
  return businessDate(now);
}

/** Soma dias a "YYYY-MM-DD" no calendário, sem envolver fuso nenhum. */
export function addCalendarDays(date: string, delta: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const moved = new Date(Date.UTC(year, month - 1, day + delta));
  return moved.toISOString().slice(0, 10);
}

/**
 * Os dois instantes que delimitam um dia da barbearia: `[start, end)`.
 *
 * Um dia de operação não é 00:00Z–23:59Z. Filtrar `timestamptz` por strings
 * ingênuas fazia o Postgres recortar o dia em UTC, e um agendamento das 23:30
 * aparecia no dia seguinte — ou sumia do dia certo.
 */
export function businessDayBounds(date: string): { start: Date; end: Date } {
  return {
    start: businessInstant(`${date}T00:00`),
    end: businessInstant(`${addCalendarDays(date, 1)}T00:00`),
  };
}

/** "15:00" no relógio da barbearia, seja quem for que esteja olhando. */
export function formatBusinessTime(value: string | Date): string {
  return TIME_FORMATTER.format(toDate(value));
}

/** Data de um instante, no fuso da barbearia. */
export function formatBusinessDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BUSINESS_TIMEZONE,
    ...options,
  }).format(toDate(value));
}

/**
 * Rótulo de um dia civil ("2026-09-22" → "terça-feira, 22 de setembro").
 * Ancorado ao meio-dia para que nenhuma conversão de fuso empurre o rótulo
 * para o dia vizinho.
 */
export function formatBusinessDayLabel(
  date: string,
  options: Intl.DateTimeFormatOptions
): string {
  return formatBusinessDate(businessInstant(`${date}T12:00`), options);
}
