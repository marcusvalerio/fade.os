import { test } from "node:test";
import assert from "node:assert/strict";
import { betaAccessRequestSchema } from "./beta-validation.ts";

const base = {
  email: "dono@barbearia.com",
  name: "Fulano",
  barbershop_name: "Barbearia do Fulano",
};

test("solicitação válida passa", () => {
  assert.equal(betaAccessRequestSchema.safeParse(base).success, true);
});

test("telefone é opcional", () => {
  assert.equal(betaAccessRequestSchema.safeParse({ ...base, phone: undefined }).success, true);
});

test("e-mail inválido é recusado", () => {
  assert.equal(betaAccessRequestSchema.safeParse({ ...base, email: "não-é-email" }).success, false);
});

test("nome vazio é recusado", () => {
  assert.equal(betaAccessRequestSchema.safeParse({ ...base, name: "" }).success, false);
});

test("nome de uma letra é recusado", () => {
  assert.equal(betaAccessRequestSchema.safeParse({ ...base, name: "A" }).success, false);
});

test("nome da barbearia vazio é recusado", () => {
  assert.equal(betaAccessRequestSchema.safeParse({ ...base, barbershop_name: "" }).success, false);
});
