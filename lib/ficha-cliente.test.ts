import { test } from "node:test";
import assert from "node:assert/strict";
import { resumoDaFicha, type ItemDaFicha } from "./ficha-cliente.ts";

const item = (attendance_id: string, servico: string | null, profissional: string | null, preco: number, kind = "service"): ItemDaFicha => ({
  attendance_id,
  kind,
  final_price: preco,
  servico,
  profissional,
});

test("sem visitas: nada inventado", () => {
  const r = resumoDaFicha([], 0);
  assert.equal(r.ticketMedio, null);
  assert.equal(r.profissionalPreferido, null);
  assert.deepEqual(r.servicosMaisUsados, []);
});

test("ticket soma serviços e produtos; produto não entra em serviços mais usados", () => {
  const r = resumoDaFicha([item("a", "Corte", "Caio", 50), item("a", null, null, 30, "product"), item("b", "Corte", "Caio", 50)], 2);
  assert.equal(r.totalGasto, 130);
  assert.equal(r.ticketMedio, 65);
  assert.deepEqual(r.servicosMaisUsados, [{ nome: "Corte", vezes: 2 }]);
});

test("serviço repetido na mesma visita conta uma vez", () => {
  const r = resumoDaFicha([item("a", "Barba", "Caio", 30), item("a", "Barba", "Caio", 30)], 1);
  assert.deepEqual(r.servicosMaisUsados, [{ nome: "Barba", vezes: 1 }]);
});

test("preferido só com duas visitas ou mais e sem empate", () => {
  assert.equal(resumoDaFicha([item("a", "Corte", "Caio", 50)], 1).profissionalPreferido, null);
  const empate = resumoDaFicha(
    [item("a", "Corte", "Caio", 50), item("b", "Corte", "Caio", 50), item("c", "Corte", "Bruno", 50), item("d", "Corte", "Bruno", 50)],
    4
  );
  assert.equal(empate.profissionalPreferido, null);
  const r = resumoDaFicha([item("a", "Corte", "Caio", 50), item("b", "Corte", "Caio", 50), item("c", "Corte", "Bruno", 50)], 3);
  assert.deepEqual(r.profissionalPreferido, { nome: "Caio", vezes: 2 });
});
