import test from "node:test";
import assert from "node:assert/strict";

import { composeEndereco } from "./endereco.ts";

test("o caso real da NORTE 21 — cidade/UF já no endereço, não repete", () => {
  assert.equal(
    composeEndereco({
      unitAddress: "Rua da Assembleia, 21 — Centro, Rio de Janeiro/RJ",
      address: "Rua da Assembleia, 21 — Centro",
      city: "Rio de Janeiro",
      state: "RJ",
    }),
    "Rua da Assembleia, 21 — Centro, Rio de Janeiro/RJ"
  );
});

test("endereço sem cidade nenhuma ganha cidade e UF", () => {
  assert.equal(
    composeEndereco({ unitAddress: "Rua do Monte, 45", city: "Niterói", state: "RJ" }),
    "Rua do Monte, 45, Niterói — RJ"
  );
});

test("endereço que já tem a cidade mas não a UF ganha só a UF", () => {
  assert.equal(
    composeEndereco({ unitAddress: "Av. Paulista, 900 — São Paulo", city: "São Paulo", state: "SP" }),
    "Av. Paulista, 900 — São Paulo — SP"
  );
});

test("sem cidade cadastrada, a UF sozinha não é grudada", () => {
  // "Rua X, RJ" faria parecer que a cidade se chama RJ.
  assert.equal(
    composeEndereco({ unitAddress: "Estrada do Morro Cavado", city: null, state: "RJ" }),
    "Estrada do Morro Cavado"
  );
});

test("sem endereço nenhum devolve null — a linha não deve ser renderizada", () => {
  assert.equal(composeEndereco({ unitAddress: null, address: null, city: "Rio de Janeiro", state: "RJ" }), null);
  assert.equal(composeEndereco({ unitAddress: "   ", address: "", city: "Rio", state: "RJ" }), null);
});

test("cai no endereço da empresa quando a unidade não tem o seu", () => {
  assert.equal(
    composeEndereco({ unitAddress: null, address: "Estrada do Morro Cavado", city: "Niterói", state: "RJ" }),
    "Estrada do Morro Cavado, Niterói — RJ"
  );
});

test("a comparação ignora acento e caixa", () => {
  assert.equal(
    composeEndereco({ unitAddress: "Rua A, 1 — SAO PAULO/sp", city: "São Paulo", state: "SP" }),
    "Rua A, 1 — SAO PAULO/sp"
  );
});

test("UF dentro de uma palavra não conta como UF já presente", () => {
  // "Marjorie" contém "rj"; sem a checagem de fronteira, a UF sumiria.
  assert.equal(
    composeEndereco({ unitAddress: "Rua Marjorie Prado, 10", city: "Niterói", state: "RJ" }),
    "Rua Marjorie Prado, 10, Niterói — RJ"
  );
});

test("UF separada por barra é reconhecida", () => {
  assert.equal(
    composeEndereco({ unitAddress: "Rua B, 2, Niterói/RJ", city: "Niterói", state: "RJ" }),
    "Rua B, 2, Niterói/RJ"
  );
});

test("nunca remove o que foi digitado", () => {
  const digitado = "Rua C, 3 — Fundos, entrada lateral, Rio de Janeiro/RJ";
  assert.ok(
    composeEndereco({ unitAddress: digitado, city: "Rio de Janeiro", state: "RJ" })!.startsWith(digitado),
    "o texto gravado tem que sobreviver inteiro"
  );
});
