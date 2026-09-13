import { test } from "node:test";
import assert from "node:assert/strict";
import { passwordSchema, emailSchema, passwordsMatch } from "./auth-validation.ts";

test("senha válida passa (maiúscula, minúscula, número, especial, 8+)", () => {
  assert.equal(passwordSchema.safeParse("Segura#123").success, true);
});

test("senha curta é recusada", () => {
  assert.equal(passwordSchema.safeParse("Ab1#").success, false);
});

test("senha sem maiúscula é recusada", () => {
  assert.equal(passwordSchema.safeParse("segura#123").success, false);
});

test("senha sem minúscula é recusada", () => {
  assert.equal(passwordSchema.safeParse("SEGURA#123").success, false);
});

test("senha sem número é recusada", () => {
  assert.equal(passwordSchema.safeParse("Segura#abc").success, false);
});

test("senha sem caractere especial é recusada", () => {
  assert.equal(passwordSchema.safeParse("Segura123").success, false);
});

test("e-mail válido passa", () => {
  assert.equal(emailSchema.safeParse("dono@barbearia.com").success, true);
});

test("e-mail sem @ é recusado", () => {
  assert.equal(emailSchema.safeParse("dono-barbearia.com").success, false);
});

test("e-mail vazio é recusado", () => {
  assert.equal(emailSchema.safeParse("").success, false);
});

test("confirmação de senha: iguais confere", () => {
  assert.equal(passwordsMatch("Segura#123", "Segura#123"), true);
});

test("confirmação de senha: diferentes não confere", () => {
  assert.equal(passwordsMatch("Segura#123", "Segura#124"), false);
});

test("confirmação de senha: diferença de maiúsculas não confere", () => {
  assert.equal(passwordsMatch("Segura#123", "segura#123"), false);
});
