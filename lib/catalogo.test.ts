import test from "node:test";
import assert from "node:assert/strict";

import {
  CATALOGO,
  comissaoOpcionalSchema,
  custoSchema,
  duracaoSchema,
  nomeCatalogoSchema,
  nomePessoaSchema,
  normalizarNome,
  precoSchema,
  textoOpcionalSchema,
} from "./catalogo.ts";

const recusa = (schema: { safeParse: (v: unknown) => { success: boolean } }, valor: unknown) =>
  schema.safeParse(valor).success === false;
const aceita = (schema: { safeParse: (v: unknown) => { success: boolean } }, valor: unknown) =>
  schema.safeParse(valor).success === true;

// --- PREÇO -----------------------------------------------------------------

test("preço negativo é recusado", () => {
  assert.ok(recusa(precoSchema, "-50"));
  assert.ok(recusa(precoSchema, -10));
});

test("preço zero é recusado — cortesia tem mecanismo próprio", () => {
  // Um item de R$ 0,00 produz um atendimento que a interface não fecha e uma
  // venda que o banco recusa por falta de pagamento. Quem quer não cobrar usa
  // cortesia, que pede autorização e motivo.
  assert.ok(recusa(precoSchema, "0"));
  assert.ok(recusa(precoSchema, 0));
});

test("preço válido passa, inclusive com centavos", () => {
  assert.equal(precoSchema.parse("55"), 55);
  assert.equal(precoSchema.parse("0.01"), 0.01);
  assert.equal(precoSchema.parse("77.50"), 77.5);
});

test("custo pode ser zero, mas não negativo", () => {
  assert.equal(custoSchema.parse("0"), 0);
  assert.ok(recusa(custoSchema, "-1"));
});

// --- DURAÇÃO ---------------------------------------------------------------

test("duração zero é recusada", () => {
  assert.ok(recusa(duracaoSchema, "0"));
});

test("duração negativa é recusada", () => {
  assert.ok(recusa(duracaoSchema, "-30"));
});

test("duração acima do teto é recusada", () => {
  assert.ok(aceita(duracaoSchema, String(CATALOGO.duracaoMax)));
  assert.ok(recusa(duracaoSchema, String(CATALOGO.duracaoMax + 1)));
  assert.ok(recusa(duracaoSchema, "99999"));
});

test("duração fracionária é recusada — minuto é a unidade", () => {
  assert.ok(recusa(duracaoSchema, "30.5"));
});

test("duração de 1 minuto é o mínimo aceito", () => {
  assert.equal(duracaoSchema.parse("1"), 1);
});

// --- COMISSÃO --------------------------------------------------------------

test("comissão negativa é recusada", () => {
  assert.ok(recusa(comissaoOpcionalSchema, "-20"));
});

test("comissão acima de 100% é recusada", () => {
  assert.ok(recusa(comissaoOpcionalSchema, "150"));
  assert.ok(recusa(comissaoOpcionalSchema, "999"));
  assert.ok(recusa(comissaoOpcionalSchema, "9999"));
});

test("comissão de 0 a 100 passa, e ausência continua permitida", () => {
  assert.equal(comissaoOpcionalSchema.parse("0"), 0);
  assert.equal(comissaoOpcionalSchema.parse("40"), 40);
  assert.equal(comissaoOpcionalSchema.parse("100"), 100);
  assert.equal(comissaoOpcionalSchema.parse(""), undefined);
  assert.equal(comissaoOpcionalSchema.parse(undefined), undefined);
});

// --- NOME ------------------------------------------------------------------

test("nome vazio é recusado", () => {
  assert.ok(recusa(nomeCatalogoSchema, ""));
});

test("nome só com espaços é recusado", () => {
  assert.ok(recusa(nomeCatalogoSchema, "     "));
  assert.ok(recusa(nomeCatalogoSchema, "\t\n  "));
});

test("nome de uma letra é recusado", () => {
  assert.ok(recusa(nomeCatalogoSchema, "P"));
});

test("nome acima do limite é recusado", () => {
  assert.ok(aceita(nomeCatalogoSchema, "X".repeat(CATALOGO.nomeMax)));
  assert.ok(recusa(nomeCatalogoSchema, "X".repeat(CATALOGO.nomeMax + 1)));
  assert.ok(recusa(nomeCatalogoSchema, "X".repeat(300)));
});

test("pessoa tem teto maior que item de catálogo", () => {
  const longo = "A".repeat(100);
  assert.ok(recusa(nomeCatalogoSchema, longo));
  assert.ok(aceita(nomePessoaSchema, longo));
  assert.ok(recusa(nomePessoaSchema, "A".repeat(CATALOGO.nomePessoaMax + 1)));
});

test("espaço em volta e espaço repetido somem", () => {
  assert.equal(normalizarNome("  Pomada  "), "Pomada");
  assert.equal(normalizarNome("Pomada   Modeladora"), "Pomada Modeladora");
  assert.equal(nomeCatalogoSchema.parse("  Corte   masculino  "), "Corte masculino");
});

test("as três grafias de Pomada viram a mesma coisa", () => {
  const grafias = ["Pomada", " Pomada ", "Pomada  ", "  Pomada"];
  const normalizadas = new Set(grafias.map(normalizarNome));
  assert.equal(normalizadas.size, 1, "deveriam colapsar num nome só");
});

test("o nome é medido depois de normalizar", () => {
  // 80 caracteres com espaço sobrando nas pontas continua cabendo.
  assert.ok(aceita(nomeCatalogoSchema, "   " + "X".repeat(CATALOGO.nomeMax) + "   "));
});

test("texto opcional vazio ou de espaços vira ausência", () => {
  assert.equal(textoOpcionalSchema.parse(""), undefined);
  assert.equal(textoOpcionalSchema.parse("   "), undefined);
  assert.equal(textoOpcionalSchema.parse(" Barba  clássica "), "Barba clássica");
});

// --- OS LIMITES NÃO PODEM DIVERGIR DO BANCO --------------------------------

test("os limites são os mesmos declarados em catalog_limits() no banco", () => {
  // Se algum destes mudar aqui sem mudar lá (ou vice-versa), a tela e o banco
  // passam a discordar — que é exatamente o problema que esta rodada resolve.
  assert.deepEqual(CATALOGO, {
    nomeMin: 2,
    nomeMax: 80,
    nomePessoaMax: 120,
    duracaoMin: 1,
    duracaoMax: 480,
    comissaoMin: 0,
    comissaoMax: 100,
  });
});
