import { test } from "node:test";
import assert from "node:assert/strict";
import { validarDocumento } from "./documento.ts";

test("vazio é permitido", () => {
  assert.deepEqual(validarDocumento(""), { ok: true, documento: null });
  assert.deepEqual(validarDocumento(null), { ok: true, documento: null });
});

test("CPF válido, com ou sem máscara", () => {
  const r = validarDocumento("529.982.247-25");
  assert.equal(r.ok, true);
  assert.deepEqual(r.ok && r.documento, { tipo: "cpf", valor: "52998224725", formatado: "529.982.247-25" });
  assert.equal(validarDocumento("52998224725").ok, true);
});

test("CPF inválido: dígito errado e repetidos", () => {
  assert.deepEqual(validarDocumento("529.982.247-24"), { ok: false, erro: "CPF inválido. Confira os 11 números." });
  assert.equal(validarDocumento("111.111.111-11").ok, false);
});

test("CNPJ numérico válido e inválido", () => {
  const r = validarDocumento("11.222.333/0001-81");
  assert.equal(r.ok && r.documento?.tipo, "cnpj");
  assert.equal(r.ok && r.documento?.formatado, "11.222.333/0001-81");
  assert.equal(validarDocumento("11.222.333/0001-80").ok, false);
  assert.equal(validarDocumento("00000000000000").ok, false);
});

test("CNPJ alfanumérico (Receita, jul/2026)", () => {
  // Exemplo oficial da Receita Federal: 12.ABC.345/01DE-35
  const r = validarDocumento("12.abc.345/01de-35");
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.documento?.valor, "12ABC34501DE35");
  assert.equal(validarDocumento("12.ABC.345/01DE-34").ok, false);
});

test("tamanho errado explica o que se espera", () => {
  const r = validarDocumento("123");
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.erro : "", /CNPJ .* CPF/);
});
