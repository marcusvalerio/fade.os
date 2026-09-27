import { test } from "node:test";
import assert from "node:assert/strict";
import { limparEvento, limparTexto, limparUrl, limparQuebra, limparSpan } from "./observabilidade-limpeza.ts";

test("texto: e-mail, telefone, CPF, CNPJ, JWT e bearer somem", () => {
  const t = limparTexto(
    "falhou para ana@x.com (21) 99999-0001 cpf 529.982.247-25 cnpj 12.ABC.345/01DE-35 jwt eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0NTY3.abcdefghijklmnop Bearer abcdefghijklmnopqrstu"
  );
  assert.equal(t.includes("ana@x.com"), false);
  assert.equal(t.includes("99999-0001"), false);
  assert.equal(t.includes("529.982.247-25"), false);
  assert.equal(t.includes("12.ABC.345/01DE-35"), false);
  assert.equal(t.includes("eyJhbGciOiJIUzI1"), false);
  assert.equal(t.includes("abcdefghijklmnopqrstu"), false);
  assert.match(t, /\[email\].*\[telefone\].*\[documento\].*\[documento\].*\[token\].*Bearer \[token\]/);
});

test("URL: token do link do cliente e ids viram :id; query sem valores", () => {
  assert.equal(
    limparUrl("https://app/norte-21/agendamentos/4a7c25ef-5aaa-4344-8358-b27ee72a2bb8?token=abc&x=1"),
    "https://app/norte-21/agendamentos/:id?token=[removido]&x=[removido]"
  );
  assert.equal(limparUrl("/clientes/ae6dd51d-e252-43f6-9a13-27899e65008d"), "/clientes/:id");
});

test("evento: cookies, corpo, headers sensíveis e dados do usuário saem", () => {
  const e = limparEvento({
    message: "erro com ana@x.com",
    transaction: "/agenda/9e678986-1fe8-4401-b022-f682c3f9fd26",
    request: {
      url: "https://app/login?next=/x",
      cookies: { "sb-access-token": "eyJ..." },
      data: { password: "segredo", email: "ana@x.com" },
      headers: { cookie: "sb=1", authorization: "Bearer x", "user-agent": "UA", "x-supabase-auth": "t" },
      query_string: "a=1",
    },
    exception: { values: [{ type: "Error", value: "Tentou com 529.982.247-25" }] },
    extra: { senha: "x", ok: "texto com ana@x.com", aninhado: { refresh_token: "r", n: 1 } },
    contexts: { state: { cliente: "Ana" }, os: { name: "Linux" } },
    user: { id: "u1", email: "ana@x.com", ip_address: "1.2.3.4", username: "Ana" },
  });
  assert.equal(e.message, "erro com [email]");
  assert.equal(e.transaction, "/agenda/:id");
  assert.equal(e.request?.cookies, undefined);
  assert.equal(e.request?.data, undefined);
  assert.equal(e.request?.query_string, undefined);
  assert.deepEqual(e.request?.headers, { "user-agent": "UA" });
  assert.equal(e.request?.url, "https://app/login?next=[removido]");
  assert.equal(e.exception?.values?.[0].value, "Tentou com [documento]");
  assert.deepEqual(e.extra, { senha: "[removido]", ok: "texto com [email]", aninhado: { refresh_token: "[removido]", n: 1 } });
  assert.deepEqual(e.contexts, { os: { name: "Linux" } });
  assert.deepEqual(e.user, { id: "u1" });
});

test("breadcrumb de fetch: URL limpa, dados sensíveis removidos", () => {
  const q = limparQuebra({
    category: "fetch",
    data: { url: "https://x.supabase.co/rest/v1/client?id=eq.ae6dd51d-e252-43f6-9a13-27899e65008d&apikey=abc", method: "GET", status_code: 200 },
  });
  assert.equal(q.data?.url, "https://x.supabase.co/rest/v1/client?id=[removido]&apikey=[removido]");
  assert.equal(q.data?.method, "GET");
});

test("span: nome e atributos sem ids, query nem dados pessoais", () => {
  const s = limparSpan({
    name: "GET /ana-barbearia/agendamentos/4a7c25ef-5aaa-4344-8358-b27ee72a2bb8",
    attributes: {
      "url.full": "https://app/x/4a7c25ef-5aaa-4344-8358-b27ee72a2bb8?token=abc",
      "http.request.header.cookie": "sb=1",
      "db.query.parameter.email": "ana@x.com",
      "sentry.op": "http.server",
      nota: "cliente ana@x.com",
      duracao: 12,
    },
  });
  assert.equal(s.name, "GET /ana-barbearia/agendamentos/:id");
  assert.equal(s.attributes["url.full"], "https://app/x/:id?token=[removido]");
  assert.equal(s.attributes["http.request.header.cookie"], "[removido]");
  assert.equal(s.attributes["db.query.parameter.email"], "[removido]");
  assert.equal(s.attributes["sentry.op"], "http.server");
  assert.equal(s.attributes.nota, "cliente [email]");
  assert.equal(s.attributes.duracao, 12);
});
