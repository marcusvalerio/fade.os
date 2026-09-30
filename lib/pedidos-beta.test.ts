import { test } from "node:test";
import assert from "node:assert/strict";
import { descricaoDaFaixa, novosPedidos, tituloDaFaixa, type PedidoPendente } from "./pedidos-beta.ts";

const p = (id: string, nome = "Victorio Alves", barbearia = "Barbearia Norte"): PedidoPendente => ({
  id,
  nome,
  barbearia,
  criadoEm: "2026-09-30T12:00:00Z",
});

test("título concorda com a quantidade", () => {
  assert.equal(tituloDaFaixa(1), "1 pedido de acesso aguardando");
  assert.equal(tituloDaFaixa(3), "3 pedidos de acesso aguardando");
});

test("descrição de um pedido usa só o primeiro nome e a barbearia", () => {
  assert.equal(descricaoDaFaixa({ total: 1, recentes: [p("a")] }), "Victorio, da Barbearia Norte, pediu acesso ao CORTEX.OS.");
});

test("descrição de vários pedidos cita o mais recente e quantos mais", () => {
  assert.equal(
    descricaoDaFaixa({ total: 3, recentes: [p("a"), p("b")] }),
    "Victorio, da Barbearia Norte, pediu acesso ao CORTEX.OS — e mais 2 pedidos esperam decisão."
  );
  assert.match(descricaoDaFaixa({ total: 2, recentes: [p("a")] }), /mais 1 pedido espera decisão/);
});

test("sem barbearia ou sem nome, a frase continua certa", () => {
  assert.equal(descricaoDaFaixa({ total: 1, recentes: [p("a", "Ana", " ")] }), "Ana pediu acesso ao CORTEX.OS.");
  assert.equal(descricaoDaFaixa({ total: 1, recentes: [p("a", " ", "")] }), "Alguém pediu acesso ao CORTEX.OS.");
});

test("novos pedidos ignoram o que a aba já viu (sem aviso duplicado)", () => {
  const vistos = new Set(["a", "b"]);
  assert.deepEqual(novosPedidos(vistos, [p("c"), p("a"), p("b")]).map((x) => x.id), ["c"]);
  assert.deepEqual(novosPedidos(new Set(["c", "a", "b"]), [p("c"), p("a")]), []);
});
