import test from "node:test";
import assert from "node:assert/strict";

import { pareceChaveDeServico } from "./service-key.ts";

test("o placeholder do .env.example é recusado", () => {
  for (const v of ["your-service-role-key", "service-role-key", "changeme", "", "   ", "xxx"]) {
    assert.equal(pareceChaveDeServico(v), false, `deveria recusar ${JSON.stringify(v)}`);
  }
});

test("a chave publicável colada no lugar da secreta é recusada", () => {
  // Este é o engano de instalação mais provável: as duas ficam lado a lado no
  // painel do Supabase. Antes ela passava e morria como "Invalid API key".
  assert.equal(pareceChaveDeServico("sb_publishable_abcdefghijklmnop"), false);
});

test("a chave secreta nova é aceita", () => {
  assert.equal(pareceChaveDeServico("sb_secret_abcdefghijklmnopqrstuv"), true);
});

test("o prefixo sozinho, sem chave, é recusado", () => {
  assert.equal(pareceChaveDeServico("sb_secret_"), false);
});

test("o JWT legado de três segmentos é aceito", () => {
  assert.equal(pareceChaveDeServico("eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.assinatura"), true);
});

test("um JWT truncado é recusado", () => {
  assert.equal(pareceChaveDeServico("eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0"), false);
});

test("espaço em volta não invalida uma chave boa", () => {
  assert.equal(pareceChaveDeServico("  sb_secret_abcdefghijklmnop  "), true);
});
