import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import {
  lerContaDeServico,
  assinarJwt,
  classificarResposta,
  montarMensagem,
  enviarPush,
  limparCacheDoToken,
  ConfiguracaoFcmAusente,
  type ContaDeServico,
} from "./fcm.ts";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const CONTA: ContaDeServico = { projectId: "cortex-teste", clientEmail: "envio@cortex-teste.iam.gserviceaccount.com", privateKey: PEM };

test("conta de serviço: ausente = null; parcial = erro que cita o que falta e nunca o valor", () => {
  assert.equal(lerContaDeServico({}), null);
  assert.throws(
    () => lerContaDeServico({ FIREBASE_PROJECT_ID: "p", FIREBASE_PRIVATE_KEY: "segredo-que-nao-pode-vazar" }),
    (e: Error) => e instanceof ConfiguracaoFcmAusente && /FIREBASE_CLIENT_EMAIL/.test(e.message) && !/segredo-que-nao-pode-vazar/.test(e.message)
  );
});

test("conta de serviço: chave com \\n literal (formato da Vercel) vira PEM de verdade", () => {
  const c = lerContaDeServico({ FIREBASE_PROJECT_ID: "p", FIREBASE_CLIENT_EMAIL: "e@x", FIREBASE_PRIVATE_KEY: PEM.replace(/\n/g, "\\n") });
  assert.equal(c?.privateKey, PEM.trim());
});

test("conta de serviço: JSON inteiro também serve; JSON inválido não mostra o conteúdo", () => {
  const c = lerContaDeServico({ FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ project_id: "p", client_email: "e@x", private_key: PEM }) });
  assert.equal(c?.projectId, "p");
  assert.throws(() => lerContaDeServico({ FIREBASE_SERVICE_ACCOUNT: "{private_key: abc" }), (e: Error) => !/abc/.test(e.message));
});

test("JWT RS256 assinado pela conta de serviço, com escopo do FCM e validade de 1 h", () => {
  const jwt = assinarJwt(CONTA, 1_000_000);
  const [h, c, s] = jwt.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(h, "base64url").toString()), { alg: "RS256", typ: "JWT" });
  const corpo = JSON.parse(Buffer.from(c, "base64url").toString());
  assert.equal(corpo.iss, CONTA.clientEmail);
  assert.equal(corpo.scope, "https://www.googleapis.com/auth/firebase.messaging");
  assert.equal(corpo.exp - corpo.iat, 3600);
  const v = createVerify("RSA-SHA256");
  v.update(`${h}.${c}`);
  assert.ok(v.verify(publicKey, Buffer.from(s, "base64url")));
});

test("chave privada ilegível vira erro de configuração", () => {
  assert.throws(() => assinarJwt({ ...CONTA, privateKey: "não é pem" }), ConfiguracaoFcmAusente);
});

test("classificação das respostas do FCM", () => {
  assert.deepEqual(classificarResposta(200, null), { status: "enviada" });
  const unreg = { error: { code: 404, status: "NOT_FOUND", details: [{ "@type": "x", errorCode: "UNREGISTERED" }] } };
  assert.equal(classificarResposta(404, unreg).status, "token_invalido");
  assert.equal(classificarResposta(400, { error: { status: "INVALID_ARGUMENT", message: "The registration token is not a valid FCM registration token" } }).status, "token_invalido");
  assert.equal(classificarResposta(400, { error: { status: "INVALID_ARGUMENT", message: "Invalid JSON payload" } }).status, "falhou");
  assert.equal(classificarResposta(403, { error: { details: [{ errorCode: "SENDER_ID_MISMATCH" }] } }).status, "token_invalido");
  const auth = classificarResposta(401, null);
  assert.equal(auth.status, "falhou");
  assert.equal(auth.status === "falhou" && auth.configuracao, true);
  assert.equal(classificarResposta(429, null).status, "tentar_de_novo");
  assert.equal(classificarResposta(503, null).status, "tentar_de_novo");
});

test("mensagem só de dados, com destino relativo e urgência pela prioridade", () => {
  const m = montarMensagem({ token: "t", notificacaoId: "n1", titulo: "T", corpo: "C", url: "/agenda", prioridade: "important", tipo: "agenda.cancelado", categoria: "agenda" });
  assert.equal("notification" in m.message, false);
  assert.equal(m.message.data.url, "/agenda");
  assert.equal(m.message.webpush.headers.Urgency, "high");
  const n = montarMensagem({ token: "t", notificacaoId: "n1", titulo: "T", corpo: "C", url: null, prioridade: "informational", tipo: "x", categoria: "produto" });
  assert.equal(n.message.data.url, "");
  assert.equal(n.message.webpush.headers.Urgency, "normal");
});

test("envio: pega o token do Google uma vez e reaproveita; token recusado vira token_invalido", async () => {
  limparCacheDoToken();
  const chamadas: string[] = [];
  const falso = (async (url: string, init?: RequestInit) => {
    chamadas.push(url);
    if (url.includes("oauth2")) return new Response(JSON.stringify({ access_token: "acesso", expires_in: 3600 }), { status: 200 });
    const corpo = JSON.parse(String(init?.body));
    assert.equal((init?.headers as Record<string, string>).authorization, "Bearer acesso");
    if (corpo.message.token === "morto") {
      return new Response(JSON.stringify({ error: { code: 404, details: [{ errorCode: "UNREGISTERED" }] } }), { status: 404 });
    }
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const base = { notificacaoId: "n", titulo: "t", corpo: "c", url: null, prioridade: "normal", tipo: "agenda.novo", categoria: "agenda" };
  assert.deepEqual(await enviarPush(CONTA, { ...base, token: "vivo" }, falso), { status: "enviada" });
  assert.equal((await enviarPush(CONTA, { ...base, token: "morto" }, falso)).status, "token_invalido");
  assert.equal(chamadas.filter((u) => u.includes("oauth2")).length, 1);
  assert.ok(chamadas.some((u) => u.includes("/v1/projects/cortex-teste/messages:send")));
});

test("envio: Google recusando a conta de serviço é erro de configuração", async () => {
  limparCacheDoToken();
  const falso = (async () => new Response("{}", { status: 400 })) as unknown as typeof fetch;
  await assert.rejects(
    enviarPush(CONTA, { token: "x", notificacaoId: "n", titulo: "t", corpo: "c", url: null, prioridade: "normal", tipo: "t", categoria: "c" }, falso),
    ConfiguracaoFcmAusente
  );
});
