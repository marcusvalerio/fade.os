import { test } from "node:test";
import assert from "node:assert/strict";
import { limitesDoMes, mesValido, rotuloDoMes } from "./mes.ts";

test("limites do mês no fuso de São Paulo", () => {
  const l = limitesDoMes("2026-09");
  assert.equal(l.de.toISOString(), "2026-09-01T03:00:00.000Z");
  assert.equal(l.ate.toISOString(), "2026-10-01T03:00:00.000Z");
  assert.equal(limitesDoMes("2026-12").seguinte, "2027-01");
  assert.equal(limitesDoMes("2026-01").anterior, "2025-12");
});

test("mês inválido ou futuro volta para o mês atual", () => {
  assert.equal(mesValido("2026-13", "2026-09-27"), "2026-09");
  assert.equal(mesValido("2026-10", "2026-09-27"), "2026-09");
  assert.equal(mesValido("2026-08", "2026-09-27"), "2026-08");
  assert.equal(mesValido(undefined, "2026-09-27"), "2026-09");
  assert.equal(rotuloDoMes("2026-09"), "Setembro de 2026");
});
