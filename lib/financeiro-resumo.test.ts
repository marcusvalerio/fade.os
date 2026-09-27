import { test } from "node:test";
import assert from "node:assert/strict";
import { resumoFinanceiro, rotuloDaCategoria } from "./financeiro-resumo.ts";

test("resultado = entradas − estornos − despesas, com origens e destinos", () => {
  const r = resumoFinanceiro([
    { type: "income", category: "venda", amount: "100.10" },
    { type: "income", category: "venda_pdv", amount: 50 },
    { type: "income", category: "venda", amount: 40 },
    { type: "expense", category: "estorno", amount: 40 },
    { type: "expense", category: "Aluguel", amount: "80.05" },
  ]);
  assert.equal(r.entradas, 190.1);
  assert.equal(r.estornos, 40);
  assert.equal(r.despesas, 80.05);
  assert.equal(r.receitaLiquida, 150.1);
  assert.equal(r.resultado, 70.05);
  assert.deepEqual(r.origens.map((o) => [o.rotulo, o.total, o.qtd]), [
    ["Atendimentos", 140.1, 2],
    ["Vendas no balcão", 50, 1],
  ]);
  assert.deepEqual(r.destinos.map((d) => d.rotulo), ["Aluguel", "Estornos (vendas canceladas)"]);
});

test("sem lançamentos, tudo zero; categoria livre mantém o nome", () => {
  const r = resumoFinanceiro([]);
  assert.equal(r.resultado, 0);
  assert.equal(rotuloDaCategoria("Compra de revenda"), "Compra de revenda");
});
