import test from "node:test";
import assert from "node:assert/strict";

import { rotularHomonimos } from "./pessoas.ts";

test("nome único não ganha identificador — nada de poluir a lista", () => {
  const r = rotularHomonimos([
    { id: "1", name: "Beatriz Continho", phone: "(21) 98100-0022" },
    { id: "2", name: "Cléber Anastácio", phone: "(21) 98100-0033" },
  ]);
  assert.deepEqual(r.map((x) => x.name), ["Beatriz Continho", "Cléber Anastácio"]);
});

test("homônimos continuam permitidos e ficam distinguíveis", () => {
  const r = rotularHomonimos([
    { id: "1", name: "Anderson Vilaça", phone: "(21) 98100-0011" },
    { id: "2", name: "Anderson Vilaça", phone: "(21) 97777-0000" },
  ]);
  assert.equal(r.length, 2, "os dois continuam na lista");
  assert.notEqual(r[0].name, r[1].name, "precisam ser distinguíveis");
  assert.equal(r[0].name, "Anderson Vilaça · final 0011");
  assert.equal(r[1].name, "Anderson Vilaça · final 0000");
});

test("só os últimos dígitos aparecem, não o telefone inteiro", () => {
  const r = rotularHomonimos([
    { id: "1", name: "Ana", phone: "(21) 98100-0011" },
    { id: "2", name: "Ana", phone: "(21) 97777-0000" },
  ]);
  assert.ok(!r[0].name.includes("98100"), "não expõe o número completo");
  assert.ok(r[0].name.endsWith("0011"));
});

test("profissional é distinguido pela função, que já é pública", () => {
  const r = rotularHomonimos([
    { id: "1", name: "Rafael Moreira", role_title: "Barbeiro" },
    { id: "2", name: "Rafael Moreira", role_title: "Barbeiro Sênior" },
  ]);
  assert.equal(r[0].name, "Rafael Moreira · Barbeiro");
  assert.equal(r[1].name, "Rafael Moreira · Barbeiro Sênior");
});

test("sem telefone nem função, cai no e-mail", () => {
  const r = rotularHomonimos([
    { id: "1", name: "Ana", email: "ana1@exemplo.com" },
    { id: "2", name: "Ana", email: "ana2@exemplo.com" },
  ]);
  assert.equal(r[0].name, "Ana · ana1@exemplo.com");
});

test("sem nenhum identificador, o nome fica como está — sem inventar", () => {
  const r = rotularHomonimos([
    { id: "1", name: "Ana" },
    { id: "2", name: "Ana" },
  ]);
  assert.deepEqual(r.map((x) => x.name), ["Ana", "Ana"]);
});

test("a colisão ignora espaços e caixa", () => {
  const r = rotularHomonimos([
    { id: "1", name: "  Ana   Paula ", phone: "(21) 90000-1111" },
    { id: "2", name: "ana paula", phone: "(21) 90000-2222" },
  ]);
  assert.ok(r[0].name.includes("final 1111"), "deveria ter detectado a colisão");
  assert.ok(r[1].name.includes("final 2222"));
});

test("telefone curto demais não vira identificador falso", () => {
  const r = rotularHomonimos([
    { id: "1", name: "Ana", phone: "12" },
    { id: "2", name: "Ana", phone: "34" },
  ]);
  assert.deepEqual(r.map((x) => x.name), ["Ana", "Ana"]);
});

test("três homônimos ficam todos distinguíveis", () => {
  const r = rotularHomonimos([
    { id: "1", name: "João", phone: "(21) 90000-1111" },
    { id: "2", name: "João", phone: "(21) 90000-2222" },
    { id: "3", name: "João", phone: "(21) 90000-3333" },
  ]);
  assert.equal(new Set(r.map((x) => x.name)).size, 3);
});

test("dois colegas com o mesmo nome E a mesma função continuam distinguíveis", () => {
  // O caso mais provável numa barbearia — e o que a primeira versão desta
  // função errava: os dois recebiam "· Barbeiro" e seguiam idênticos.
  const r = rotularHomonimos([
    { id: "1", name: "Anderson Vilaça", role_title: "Barbeiro", phone: "(21) 98100-0011" },
    { id: "2", name: "Anderson Vilaça", role_title: "Barbeiro", phone: "(21) 97777-0000" },
  ]);
  assert.notEqual(r[0].name, r[1].name, "precisam ser distinguíveis");
  assert.equal(r[0].name, "Anderson Vilaça · final 0011");
  assert.equal(r[1].name, "Anderson Vilaça · final 0000");
});

test("a função é preferida ao telefone quando ela já separa", () => {
  const r = rotularHomonimos([
    { id: "1", name: "Rafael Moreira", role_title: "Barbeiro", phone: "(21) 98100-0011" },
    { id: "2", name: "Rafael Moreira", role_title: "Barbeiro Sênior", phone: "(21) 97777-0000" },
  ]);
  assert.equal(r[0].name, "Rafael Moreira · Barbeiro");
  assert.equal(r[1].name, "Rafael Moreira · Barbeiro Sênior");
});

test("cai no e-mail quando função e telefone empatam", () => {
  const r = rotularHomonimos([
    { id: "1", name: "Ana", role_title: "Barbeira", phone: "1111", email: "ana1@exemplo.com" },
    { id: "2", name: "Ana", role_title: "Barbeira", phone: "1111", email: "ana2@exemplo.com" },
  ]);
  assert.equal(r[0].name, "Ana · ana1@exemplo.com");
  assert.equal(r[1].name, "Ana · ana2@exemplo.com");
});

test("a ordem da lista de entrada é preservada", () => {
  const r = rotularHomonimos([
    { id: "1", name: "Zeca" },
    { id: "2", name: "Ana", phone: "(21) 90000-1111" },
    { id: "3", name: "Ana", phone: "(21) 90000-2222" },
  ]);
  assert.deepEqual(r.map((x) => x.id), ["1", "2", "3"]);
  assert.equal(r[0].name, "Zeca");
});
