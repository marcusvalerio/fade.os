import { test } from "node:test";
import assert from "node:assert/strict";
import { distribuirEmFaixas, segundaDaSemana } from "./agenda-semana.ts";

test("blocos sem sobreposição ficam em uma faixa só", () => {
  const f = distribuirEmFaixas([
    { id: "a", inicio: 540, fim: 570 },
    { id: "b", inicio: 570, fim: 600 },
  ]);
  assert.deepEqual(f.get("a"), { faixa: 0, total: 1 });
  assert.deepEqual(f.get("b"), { faixa: 0, total: 1 });
});

test("sobrepostos dividem a coluna e reusam a faixa que liberou", () => {
  const f = distribuirEmFaixas([
    { id: "a", inicio: 540, fim: 600 },
    { id: "b", inicio: 555, fim: 585 },
    { id: "c", inicio: 590, fim: 620 },
  ]);
  assert.equal(f.get("a")!.total, 2);
  assert.equal(f.get("b")!.faixa, 1);
  assert.equal(f.get("c")!.faixa, 1);
});

test("grupos separados não herdam faixas um do outro", () => {
  const f = distribuirEmFaixas([
    { id: "a", inicio: 540, fim: 600 },
    { id: "b", inicio: 560, fim: 590 },
    { id: "c", inicio: 700, fim: 730 },
  ]);
  assert.deepEqual(f.get("c"), { faixa: 0, total: 1 });
});

test("a semana começa na segunda", () => {
  assert.equal(segundaDaSemana("2026-09-27"), "2026-09-21"); // domingo
  assert.equal(segundaDaSemana("2026-09-21"), "2026-09-21"); // segunda
  assert.equal(segundaDaSemana("2026-10-01"), "2026-09-28"); // quinta, vira o mês
});
