import test from "node:test";
import assert from "node:assert/strict";

import { resolvePeriod } from "./period.ts";
import { businessDate, businessDayBounds, businessInstant, businessToday } from "./time.ts";

// Rodam com TZ=UTC, como o servidor em produção. Era justamente aí que o
// recorte antigo errava.

test("um evento das 23:30 BRT pertence ao dia dele", () => {
  const tarde = businessInstant("2026-09-09T23:30");
  assert.equal(tarde.toISOString(), "2026-09-10T02:30:00.000Z");
  assert.equal(businessDate(tarde), "2026-09-09");

  const { start, end } = businessDayBounds("2026-09-09");
  assert.ok(tarde >= start && tarde < end, "23:30 deveria cair no dia 09");
});

test("um evento das 00:30 BRT pertence ao dia dele, não à véspera", () => {
  const madrugada = businessInstant("2026-09-09T00:30");
  assert.equal(madrugada.toISOString(), "2026-09-09T03:30:00.000Z");
  assert.equal(businessDate(madrugada), "2026-09-09");

  const { start, end } = businessDayBounds("2026-09-09");
  assert.ok(madrugada >= start && madrugada < end, "00:30 deveria cair no dia 09");

  // E o recorte UTC ingênuo — o que existia antes — colocaria as duas pontas
  // no dia errado. Este é o contraste que a correção elimina.
  const recorteUtcIngenuo = madrugada.toISOString().slice(0, 10);
  assert.equal(recorteUtcIngenuo, "2026-09-09");
  const tarde = businessInstant("2026-09-09T23:30");
  assert.equal(tarde.toISOString().slice(0, 10), "2026-09-10", "é o erro antigo, documentado");
});

test("período de um dia cobre exatamente 24 horas da barbearia", () => {
  const { start, end } = businessDayBounds("2026-09-09");
  assert.equal((end.getTime() - start.getTime()) / 3_600_000, 24);
  assert.equal(start.toISOString(), "2026-09-09T03:00:00.000Z");
  assert.equal(end.toISOString(), "2026-09-10T03:00:00.000Z");
});

test("hoje é o dia da barbearia, mesmo com o servidor em UTC", () => {
  // 01:00Z do dia 10 ainda são 22:00 do dia 09 na barbearia.
  const periodo = resolvePeriodEm("hoje", new Date("2026-09-10T01:00:00Z"));
  assert.equal(periodo.start, "2026-09-09");
  assert.equal(periodo.end, "2026-09-09");
});

test("7 dias cobre a semana toda e o anterior é a semana de antes", () => {
  const p = resolvePeriodEm("7dias", new Date("2026-09-10T15:00:00Z"));
  assert.equal(p.end, "2026-09-10");
  assert.equal(p.start, "2026-09-04");
  assert.equal(p.previousEnd, "2026-09-03");
  assert.equal(p.previousStart, "2026-08-28");
});

test("o mês começa no dia 1 e o anterior é o mês inteiro de antes", () => {
  const p = resolvePeriodEm("mes", new Date("2026-09-10T15:00:00Z"));
  assert.equal(p.start, "2026-09-01");
  assert.equal(p.end, "2026-09-10");
  assert.equal(p.previousEnd, "2026-08-31");
  assert.equal(p.previousStart, "2026-08-22"); // mesma duração, 10 dias
});

test("virada de mês não perde nem repete dia", () => {
  const p = resolvePeriod("personalizado", "2026-08-30", "2026-09-02");
  assert.equal(p.previousEnd, "2026-08-29");
  assert.equal(p.previousStart, "2026-08-26");
});

test("virada de ano atravessa sem quebrar", () => {
  const p = resolvePeriod("personalizado", "2025-12-30", "2026-01-02");
  assert.equal(p.previousEnd, "2025-12-29");
  assert.equal(p.previousStart, "2025-12-26");
});

test("ano bissexto é respeitado", () => {
  const p = resolvePeriod("personalizado", "2028-03-01", "2028-03-01");
  assert.equal(p.previousEnd, "2028-02-29");
  assert.equal(p.previousStart, "2028-02-29");
});

test("período personalizado invertido é ordenado em vez de virar janela vazia", () => {
  const p = resolvePeriod("personalizado", "2026-09-20", "2026-09-10");
  assert.equal(p.start, "2026-09-10");
  assert.equal(p.end, "2026-09-20");
});

test("um dia só tem período anterior de um dia só", () => {
  const p = resolvePeriod("personalizado", "2026-09-09", "2026-09-09");
  assert.equal(p.previousStart, "2026-09-08");
  assert.equal(p.previousEnd, "2026-09-08");
});

/**
 * `resolvePeriod` lê o relógio real; para fixar um instante, o teste calcula
 * o mesmo que a função calcularia naquele momento.
 */
function resolvePeriodEm(preset: "hoje" | "7dias" | "mes", agora: Date) {
  const hoje = businessToday(agora);
  if (preset === "hoje") return resolvePeriod("personalizado", hoje, hoje);
  if (preset === "mes") return resolvePeriod("personalizado", `${hoje.slice(0, 7)}-01`, hoje);
  const inicio = new Date(Date.UTC(...(hoje.split("-").map(Number) as [number, number, number])));
  inicio.setUTCMonth(inicio.getUTCMonth() - 1 + 1);
  return resolvePeriod(
    "personalizado",
    new Date(Date.parse(`${hoje}T00:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10),
    hoje
  );
}
