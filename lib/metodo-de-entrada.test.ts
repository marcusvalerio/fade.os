import { test } from "node:test";
import assert from "node:assert/strict";
import { metodosDaSessao, entrouPeloGoogle } from "./metodo-de-entrada.ts";

function token(payload: object): string {
  const b64 = (s: string) => Buffer.from(s).toString("base64url");
  return `${b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64(JSON.stringify(payload))}.assinatura`;
}

test("login por e-mail e senha não é Google", () => {
  const t = token({ sub: "u", amr: [{ method: "password", timestamp: 1 }] });
  assert.deepEqual(metodosDaSessao(t), ["password"]);
  assert.equal(entrouPeloGoogle(t), false);
});

test("login pelo Google é reconhecido", () => {
  const t = token({ sub: "u", amr: [{ method: "oauth", timestamp: 1 }] });
  assert.equal(entrouPeloGoogle(t), true);
});

test("recuperação de senha e confirmação de e-mail não contam como Google", () => {
  assert.equal(entrouPeloGoogle(token({ amr: [{ method: "recovery", timestamp: 1 }] })), false);
  assert.equal(entrouPeloGoogle(token({ amr: [{ method: "otp", timestamp: 1 }] })), false);
});

test("nome com acento no payload não quebra a leitura", () => {
  const t = token({ user_metadata: { name: "João Ávila" }, amr: [{ method: "oauth", timestamp: 1 }] });
  assert.equal(entrouPeloGoogle(t), true);
});

test("token ilegível não bloqueia nada", () => {
  assert.equal(entrouPeloGoogle("isto-nao-e-um-jwt"), false);
  assert.equal(entrouPeloGoogle("a.%%%.c"), false);
  assert.deepEqual(metodosDaSessao(token({ sub: "u" })), []);
});
