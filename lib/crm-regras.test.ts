import test from "node:test";
import assert from "node:assert/strict";

import { comportamentoDoCliente } from "./crm-regras.ts";

const DIA = 24 * 60 * 60 * 1000;
const agora = Date.UTC(2026, 8, 26, 15, 0, 0);

/** Visitas a cada `intervalo` dias, a última há `desde` dias. */
function visitas(intervalo: number, desde: number, quantas = 4) {
  const ultima = agora - desde * DIA;
  return Array.from({ length: quantas }, (_, i) => ultima - (quantas - 1 - i) * intervalo * DIA);
}

test("sem histórico suficiente o cliente é ativo — recém-chegado não é problema", () => {
  const c = comportamentoDoCliente("x", [agora - 90 * DIA], agora);
  assert.equal(c.status, "ativo");
  assert.equal(c.avgGapDays, null);
  assert.equal(c.daysSinceVisit, 90);
});

// Os números da maquete da landing (app/_landing/screens.tsx, ClientesRitmo)
// precisam bater com a régua do produto — foi assim que a auditoria achou
// "34 dias num ritmo de 30 = atenção", que na verdade é ativo.
test("34 dias num ritmo de 30 ainda é ativo (razão ≤ 1,5)", () => {
  assert.equal(comportamentoDoCliente("x", visitas(30, 34), agora).status, "ativo");
});

test("52 dias num ritmo de 30 é atenção", () => {
  const c = comportamentoDoCliente("x", visitas(30, 52), agora);
  assert.equal(c.avgGapDays, 30);
  assert.equal(c.daysSinceVisit, 52);
  assert.equal(c.status, "atencao");
});

test("80 dias num ritmo de 25 é recuperação", () => {
  assert.equal(comportamentoDoCliente("x", visitas(25, 80), agora).status, "recuperacao");
});

test("acima de 4× o próprio ritmo o cliente é inativo", () => {
  assert.equal(comportamentoDoCliente("x", visitas(20, 90), agora).status, "inativo");
});

import { mensagemDeRetorno, urgenciaDeRetorno } from "./crm-regras.ts";

test("mensagem de retorno usa o primeiro nome e o tempo real, sem promessa", () => {
  assert.equal(
    mensagemDeRetorno("Carlos Ribeiro", "NORTE 21", 52),
    "Oi, Carlos! Aqui é da NORTE 21. Faz 52 dias da sua última visita — quer que a gente reserve um horário pra você?"
  );
  assert.match(mensagemDeRetorno("Ana", "X", null), /Faz um tempo da sua última visita/);
});

test("urgência ordena pelo quanto passou do próprio ritmo", () => {
  assert.equal(urgenciaDeRetorno({ avgGapDays: 25, daysSinceVisit: 80 }), 3.2);
  assert.equal(urgenciaDeRetorno({ avgGapDays: null, daysSinceVisit: 10 }), 0);
});
