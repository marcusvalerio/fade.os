import test from "node:test";
import assert from "node:assert/strict";

import {
  BUSINESS_TIMEZONE,
  addCalendarDays,
  businessDate,
  businessDayBounds,
  businessInstant,
  businessToday,
  formatBusinessDayLabel,
  formatBusinessTime,
} from "./time.ts";

// Estes testes rodam com o TZ do processo em UTC (é assim que o servidor roda
// em produção). É justamente aí que a implementação antiga errava: se eles
// passarem num ambiente UTC, passam em qualquer um.

test("o fuso operacional é o da barbearia", () => {
  assert.equal(BUSINESS_TIMEZONE, "America/Sao_Paulo");
});

test("horário digitado é lido como relógio da barbearia, não como UTC", () => {
  // 10:00 em São Paulo (UTC−3) é 13:00Z. O bug antigo produzia 10:00Z.
  assert.equal(businessInstant("2026-09-22T10:00").toISOString(), "2026-09-22T13:00:00.000Z");
});

test("o caso comprovado em produção: 15:00 na barbearia é 18:00Z", () => {
  assert.equal(businessInstant("2026-09-22T15:00").toISOString(), "2026-09-22T18:00:00.000Z");
});

test("e o caminho de volta: 18:00Z é exibido como 15:00", () => {
  assert.equal(formatBusinessTime("2026-09-22T18:00:00+00:00"), "15:00");
});

test("bloqueio de 14:00–15:00 permanece 14:00–15:00", () => {
  const start = businessInstant("2026-09-22T14:00");
  const end = businessInstant("2026-09-22T15:00");
  assert.equal(start.toISOString(), "2026-09-22T17:00:00.000Z");
  assert.equal(formatBusinessTime(start), "14:00");
  assert.equal(formatBusinessTime(end), "15:00");
});

test("aceita segundos e espaço no lugar do T", () => {
  assert.equal(businessInstant("2026-09-22 10:00:30").toISOString(), "2026-09-22T13:00:30.000Z");
});

test("recusa entrada malformada em vez de inventar um instante", () => {
  assert.throws(() => businessInstant("22/09/2026 10:00"));
  assert.throws(() => businessInstant(""));
});

test("meia-noite e vésperas não escorregam de dia", () => {
  // 23:30 na barbearia é 02:30Z do dia seguinte — mas continua sendo dia 22.
  const tardeDaNoite = businessInstant("2026-09-22T23:30");
  assert.equal(tardeDaNoite.toISOString(), "2026-09-23T02:30:00.000Z");
  assert.equal(businessDate(tardeDaNoite), "2026-09-22");
  assert.equal(formatBusinessTime(tardeDaNoite), "23:30");

  // E 00:15 é 03:15Z do mesmo dia.
  const madrugada = businessInstant("2026-09-22T00:15");
  assert.equal(madrugada.toISOString(), "2026-09-22T03:15:00.000Z");
  assert.equal(businessDate(madrugada), "2026-09-22");
});

test("o dia da barbearia vai de 03:00Z a 03:00Z, não de 00:00Z a 00:00Z", () => {
  const { start, end } = businessDayBounds("2026-09-22");
  assert.equal(start.toISOString(), "2026-09-22T03:00:00.000Z");
  assert.equal(end.toISOString(), "2026-09-23T03:00:00.000Z");
});

test("um agendamento das 23:30 cai dentro do dia dele", () => {
  const { start, end } = businessDayBounds("2026-09-22");
  const linha = businessInstant("2026-09-22T23:30");
  assert.ok(linha >= start && linha < end, "23:30 deveria pertencer ao dia 22");

  const doDiaSeguinte = businessInstant("2026-09-23T00:05");
  assert.ok(doDiaSeguinte >= end, "00:05 do dia 23 não pertence ao dia 22");
});

test("hoje é o dia da barbearia, não o do relógio do servidor", () => {
  // 01:00Z do dia 23 ainda é dia 22 na barbearia (22:00 de lá).
  assert.equal(businessToday(new Date("2026-09-23T01:00:00Z")), "2026-09-22");
  assert.equal(businessToday(new Date("2026-09-23T04:00:00Z")), "2026-09-23");
});

test("navegação de dia não pula nem repete data", () => {
  assert.equal(addCalendarDays("2026-09-22", 1), "2026-09-23");
  assert.equal(addCalendarDays("2026-09-22", -1), "2026-09-21");
  assert.equal(addCalendarDays("2026-09-30", 1), "2026-10-01");
  assert.equal(addCalendarDays("2026-01-01", -1), "2025-12-31");
  assert.equal(addCalendarDays("2028-02-28", 1), "2028-02-29"); // bissexto
});

test("o rótulo do dia não escorrega para o vizinho", () => {
  assert.equal(
    formatBusinessDayLabel("2026-09-22", { weekday: "long", day: "2-digit", month: "long" }),
    "terça-feira, 22 de setembro"
  );
});

test("a conversão é reversível para qualquer hora do dia", () => {
  for (let hora = 0; hora < 24; hora++) {
    const parede = `${String(hora).padStart(2, "0")}:45`;
    const instante = businessInstant(`2026-09-22T${parede}`);
    assert.equal(formatBusinessTime(instante), parede, `falhou às ${parede}`);
    assert.equal(businessDate(instante), "2026-09-22", `dia errado às ${parede}`);
  }
});

test("sobrevive a uma virada de horário de verão", () => {
  // O Brasil não usa horário de verão hoje, mas a conversão não pode depender
  // disso. Em 2018 São Paulo entrou no horário de verão em 04/11 (UTC−3 → −2).
  assert.equal(businessInstant("2018-11-03T12:00").toISOString(), "2018-11-03T15:00:00.000Z");
  assert.equal(businessInstant("2018-11-05T12:00").toISOString(), "2018-11-05T14:00:00.000Z");
  assert.equal(formatBusinessTime("2018-11-05T14:00:00Z"), "12:00");
});
