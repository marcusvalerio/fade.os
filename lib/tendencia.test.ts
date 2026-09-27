import { test } from "node:test";
import assert from "node:assert/strict";
import { porSemana, inicioDaJanela, temTendencia } from "./tendencia.ts";

test("janela de 12 semanas termina na semana de hoje (segunda a domingo)", () => {
  // 27/09/2026 é domingo: a semana corrente começa em 21/09.
  assert.equal(inicioDaJanela("2026-09-27"), "2026-07-06");
  const s = porSemana([], "2026-09-27");
  assert.equal(s.length, 12);
  assert.equal(s[11].inicio, "2026-09-21");
});

test("agrupa por semana e calcula ticket só com atendimento", () => {
  const s = porSemana(
    [
      { dia: "2026-09-21", faturamento: 100, atendimentos: 2, clientes_novos: 1 },
      { dia: "2026-09-27", faturamento: 50.5, atendimentos: 1, clientes_novos: 0 },
      { dia: "2026-09-14", faturamento: 30, atendimentos: 0, clientes_novos: 0 },
      { dia: "2026-01-01", faturamento: 999, atendimentos: 9, clientes_novos: 9 }, // fora da janela
    ],
    "2026-09-27"
  );
  assert.deepEqual(s[11], { inicio: "2026-09-21", faturamento: 150.5, atendimentos: 3, clientesNovos: 1, ticket: 50.17 });
  assert.equal(s[10].faturamento, 30);
  assert.equal(s[10].ticket, null);
  assert.equal(s.reduce((t, x) => t + x.atendimentos, 0), 3);
});

test("tendência só com 2+ semanas com dado", () => {
  assert.equal(temTendencia([0, 0, 10]), false);
  assert.equal(temTendencia([null, 5, 0, 10]), true);
});
