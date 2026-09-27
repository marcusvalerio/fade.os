import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarResposta, limparOpcoes, errosDaPesquisa } from "./pesquisas.ts";

test("nota: inteiro de 1 a 5", () => {
  assert.equal(normalizarResposta("nota", [], 4), 4);
  assert.equal(normalizarResposta("nota", [], 6), null);
  assert.equal(normalizarResposta("nota", [], 4.5), null);
  assert.equal(normalizarResposta("nota", [], "4"), null);
});

test("escolha e múltipla só aceitam opções existentes; múltipla sai na ordem das opções", () => {
  const op = ["Fácil", "Ok", "Difícil"];
  assert.equal(normalizarResposta("escolha", op, "Ok"), "Ok");
  assert.equal(normalizarResposta("escolha", op, "Péssimo"), null);
  assert.deepEqual(normalizarResposta("multipla", op, ["Difícil", "Fácil"]), ["Fácil", "Difícil"]);
  assert.equal(normalizarResposta("multipla", op, []), null);
  assert.equal(normalizarResposta("multipla", op, ["Ok", "X"]), null);
});

test("sim/não e texto", () => {
  assert.equal(normalizarResposta("sim_nao", [], false), false);
  assert.equal(normalizarResposta("sim_nao", [], "sim"), null);
  assert.equal(normalizarResposta("texto", [], "  bom  "), "bom");
  assert.equal(normalizarResposta("texto", [], "   "), null);
  assert.equal(normalizarResposta("texto", [], "x".repeat(1001)), null);
});

test("opções: sem vazias e sem repetidas ignorando maiúsculas", () => {
  assert.deepEqual(limparOpcoes([" Fácil ", "", "fácil", "Ok"]), ["Fácil", "Ok"]);
});

test("erros do formulário da pesquisa", () => {
  const base = { titulo: "Agenda", pergunta: "Como está a agenda?", tipo: "nota" as const, opcoes: [], publico: ["gestor" as const], publicarEm: null, encerrarEm: null };
  assert.deepEqual(errosDaPesquisa(base), {});
  assert.ok(errosDaPesquisa({ ...base, tipo: "escolha", opcoes: ["A", "a"] }).opcoes);
  assert.ok(errosDaPesquisa({ ...base, publico: [] }).publico);
  assert.ok(errosDaPesquisa({ ...base, publicarEm: "2026-10-02T10:00", encerrarEm: "2026-10-01T10:00" }).encerrarEm);
});
