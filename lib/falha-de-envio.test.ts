import { test } from "node:test";
import assert from "node:assert/strict";
import { classificarFalha, mensagemDaFalha, MENSAGEM_FALHA_AO_SALVAR, MENSAGEM_SEM_CONEXAO } from "./falha-de-envio.ts";

test("pedido que não chegou é queda de rede, em qualquer navegador", () => {
  for (const mensagem of [
    "Failed to fetch", // Chrome
    "NetworkError when attempting to fetch resource.", // Firefox
    "Load failed", // Safari
    "Network request failed",
    "fetch failed", // Node
  ]) {
    assert.equal(classificarFalha(new TypeError(mensagem)), "rede", mensagem);
  }
});

test("navegador offline é queda de rede, seja qual for o erro", () => {
  assert.equal(classificarFalha(new Error("qualquer coisa"), false), "rede");
});

test("resposta que não é do app (gateway, tempo esgotado) é separada da queda de rede", () => {
  assert.equal(classificarFalha(new Error("An unexpected response was received from the server.")), "resposta");
});

test("exceção do servidor ou do próprio código é exceção", () => {
  assert.equal(classificarFalha(new Error("An error occurred in the Server Components render.")), "excecao");
  assert.equal(classificarFalha(new TypeError("Cannot read properties of undefined (reading 'ok')")), "excecao");
  assert.equal(classificarFalha(undefined), "excecao");
  assert.equal(classificarFalha("texto solto"), "excecao");
});

test("só duas frases, e nenhuma com texto técnico", () => {
  assert.equal(mensagemDaFalha("rede"), MENSAGEM_SEM_CONEXAO);
  assert.equal(mensagemDaFalha("resposta"), MENSAGEM_SEM_CONEXAO);
  assert.equal(mensagemDaFalha("excecao"), MENSAGEM_FALHA_AO_SALVAR);
  for (const frase of [MENSAGEM_SEM_CONEXAO, MENSAGEM_FALHA_AO_SALVAR]) {
    assert.doesNotMatch(frase, /error|fetch|NEXT_|undefined|stack/i);
  }
});
