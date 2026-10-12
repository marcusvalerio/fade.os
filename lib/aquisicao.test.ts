import { test } from "node:test";
import assert from "node:assert/strict";
import { montarFunil, taxa } from "./aquisicao.ts";

const base = {
  visitantes: null,
  interessados: null,
  cadastrosIniciados: null,
  pedidosBeta: 10,
  aprovados: 8,
  empresas: 6,
  onboardingsConcluidos: 5,
  primeiroUso: 4,
  ativas: 2,
};

test("sem coleta do site, as etapas do site ficam vazias e não inventam conversão", () => {
  const f = montarFunil(base);
  assert.equal(f[0].valor, null);
  assert.equal(f[0].conversao, null);
  const pedidos = f.find((e) => e.chave === "pedidos_beta")!;
  assert.equal(pedidos.conversao, null, "a primeira etapa medida não tem de onde converter");
  assert.equal(f.find((e) => e.chave === "aprovados")!.conversao, 80);
  assert.equal(f.find((e) => e.chave === "ativas")!.conversao, 50);
});

test("com coleta do site, a conversão corre de ponta a ponta", () => {
  const f = montarFunil({ ...base, visitantes: 1000, interessados: 200, cadastrosIniciados: 40 });
  assert.equal(f[1].conversao, 20);
  assert.equal(f.find((e) => e.chave === "pedidos_beta")!.conversao, 25);
});

test("taxa nunca divide por zero nem por dado ausente", () => {
  assert.equal(taxa(3, 0), null);
  assert.equal(taxa(null, 10), null);
  assert.equal(taxa(1, 3), 33.3);
});
