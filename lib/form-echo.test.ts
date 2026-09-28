import { test } from "node:test";
import assert from "node:assert/strict";
import { ecoDoFormulario, lerEco } from "./form-echo.ts";

// O que um formulário real manda: caixa desmarcada não vem no FormData.
function envio(campos: Record<string, string>) {
  const dados = new FormData();
  for (const [chave, valor] of Object.entries(campos)) dados.append(chave, valor);
  return ecoDoFormulario(dados);
}

test("sem eco, tudo vem do banco", () => {
  const eco = lerEco(undefined);
  assert.equal(eco.texto("city", "Recife"), "Recife");
  assert.equal(eco.texto("notes", null), "");
  assert.equal(eco.texto("price", 45), "45");
  assert.equal(eco.opcao("status", "active"), "active");
  assert.equal(eco.marcado("consent", true), true);
  assert.equal(eco.escolhido("tipo", "b", false), false);
});

test("texto: 'Olinda' enviado continua 'Olinda', mesmo com 'Recife' no banco", () => {
  const eco = lerEco(envio({ city: "Olinda" }));
  assert.equal(eco.texto("city", "Recife"), "Olinda");
});

test("texto apagado de propósito continua vazio", () => {
  assert.equal(lerEco(envio({ notes: "" })).texto("notes", "anotação antiga"), "");
});

test("select: a opção B enviada vence a do banco", () => {
  assert.equal(lerEco(envio({ status: "inactive" })).opcao("status", "active"), "inactive");
});

test("checkbox OFF → erro → continua OFF, mesmo com ON no banco", () => {
  assert.equal(lerEco(envio({ name: "Carla" })).marcado("consent", true), false);
});

test("checkbox ON → erro → continua ON, mesmo com OFF no banco", () => {
  assert.equal(lerEco(envio({ name: "Carla", consent: "on" })).marcado("consent", false), true);
});

test("radio: a opção enviada, e só ela", () => {
  const eco = lerEco(envio({ tipo: "b" }));
  assert.equal(eco.escolhido("tipo", "b", false), true);
  assert.equal(eco.escolhido("tipo", "a", true), false);
});

test("combinação: nome, select, checkbox e textarea voltam exatamente como foram enviados", () => {
  const eco = lerEco(envio({ name: "Barbearia Norte Centro", status: "inactive", notes: "linha 1\nlinha 2" }));
  assert.equal(eco.texto("name", "Barbearia Norte"), "Barbearia Norte Centro");
  assert.equal(eco.opcao("status", "active"), "inactive");
  assert.equal(eco.marcado("is_public", true), false);
  assert.equal(eco.texto("notes", "antiga"), "linha 1\nlinha 2");
});

test("arquivo não volta pelo eco", () => {
  const dados = new FormData();
  dados.append("name", "Pomada");
  dados.append("foto", new Blob(["x"]), "foto.png");
  assert.deepEqual(ecoDoFormulario(dados), { name: "Pomada" });
});
