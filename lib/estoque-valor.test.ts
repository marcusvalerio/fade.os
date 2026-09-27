import { test } from "node:test";
import assert from "node:assert/strict";
import { valorDoEstoque } from "./estoque-valor.ts";

test("valor a custo e a preço de venda, só do saldo positivo", () => {
  const v = valorDoEstoque([
    { current_stock: 3, minimum_stock: 2, cost_price: "10.50", sale_price: 30 },
    { current_stock: "2", minimum_stock: 5, cost_price: 4, sale_price: null },
    { current_stock: 0, minimum_stock: 1, cost_price: 99, sale_price: 200 },
    { current_stock: -1, minimum_stock: 0, cost_price: 5 },
  ]);
  assert.equal(v.custoTotal, 39.5);
  assert.equal(v.vendaTotal, 90);
  assert.equal(v.abaixoDoMinimo, 3);
  assert.equal(v.zerados, 2);
  assert.equal(v.semCusto, 0);
});

test("item com saldo e sem custo é contado à parte, não somado", () => {
  const v = valorDoEstoque([
    { current_stock: 5, minimum_stock: 0, cost_price: null },
    { current_stock: 5, minimum_stock: 0, cost_price: 0 },
  ]);
  assert.equal(v.custoTotal, 0);
  assert.equal(v.semCusto, 2);
});
