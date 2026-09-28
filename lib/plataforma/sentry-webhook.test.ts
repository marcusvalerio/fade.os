import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { assinaturaValida, interpretarWebhookDoSentry } from "./sentry-webhook.ts";

const SEGREDO = "segredo-de-teste-com-32-caracteres!";
const assinar = (corpo: string) => createHmac("sha256", SEGREDO).update(corpo).digest("hex");

test("assinatura: aceita só HMAC do corpo com o segredo", () => {
  const corpo = JSON.stringify({ a: 1 });
  assert.equal(assinaturaValida(corpo, assinar(corpo), SEGREDO), true);
  assert.equal(assinaturaValida(corpo + " ", assinar(corpo), SEGREDO), false);
  assert.equal(assinaturaValida(corpo, "00", SEGREDO), false);
  assert.equal(assinaturaValida(corpo, null, SEGREDO), false);
  // sem segredo configurado, o endpoint fica desligado
  assert.equal(assinaturaValida(corpo, assinar(corpo), undefined), false);
  assert.equal(assinaturaValida(corpo, assinar(corpo), "curto"), false);
});

const alertaDeEvento = (extra: Record<string, unknown> = {}) => ({
  action: "triggered",
  data: {
    triggered_rule: "Erro crítico no caixa",
    event: {
      issue_id: "4455",
      event_id: "abc",
      title: "TypeError: x is undefined",
      environment: "production",
      message: "senha=123 token=eyJ...",
      user: { email: "pessoa@exemplo.com" },
      tags: [["empresa_id", "7c19e075-7cf6-4017-96d2-5c9bc49d25bb"], ["environment", "production"]],
      ...extra,
    },
  },
});

test("alerta de evento em produção vira um incidente por issue por dia, sem dados pessoais", () => {
  const i = interpretarWebhookDoSentry("event_alert", alertaDeEvento(), "2026-09-28")!;
  assert.equal(i.chave, "sentry.issue:4455:2026-09-28");
  assert.equal(i.dados.empresa, "7c19e075-7cf6-4017-96d2-5c9bc49d25bb");
  assert.match(i.corpo, /TypeError/);
  assert.doesNotMatch(i.corpo + i.titulo, /senha|token|@|eyJ/);
  // o mesmo issue no mesmo dia gera a mesma chave (o banco deduplica)
  assert.equal(interpretarWebhookDoSentry("event_alert", alertaDeEvento({ event_id: "outro" }), "2026-09-28")!.chave, i.chave);
});

test("fora de produção, resolvido, aviso ou issue comum não viram notificação", () => {
  assert.equal(interpretarWebhookDoSentry("event_alert", alertaDeEvento({ environment: "preview" }), "d"), null);
  assert.equal(interpretarWebhookDoSentry("event_alert", { ...alertaDeEvento(), action: "resolved" }, "d"), null);
  assert.equal(interpretarWebhookDoSentry("issue", { action: "created", data: { issue: { id: "1" } } }, "d"), null);
  assert.equal(interpretarWebhookDoSentry("metric_alert", { action: "warning", data: { metric_alert: { id: "9" } } }, "d"), null);
  assert.equal(interpretarWebhookDoSentry("metric_alert", { action: "resolved", data: { metric_alert: { id: "9" } } }, "d"), null);
  assert.equal(interpretarWebhookDoSentry("installation", { action: "created" }, "d"), null);
  assert.equal(interpretarWebhookDoSentry("event_alert", null, "d"), null);
});

test("alerta de métrica crítico vira incidente; empresa só entra se for UUID", () => {
  const m = interpretarWebhookDoSentry("metric_alert", {
    action: "critical",
    data: { description_title: "Taxa de erro acima de 5%", metric_alert: { id: 77, alert_rule: { name: "Erros" } } },
  }, "2026-09-28")!;
  assert.equal(m.chave, "sentry.metrica:77:2026-09-28");
  assert.match(m.corpo, /Taxa de erro/);
  const semEmpresa = interpretarWebhookDoSentry("event_alert", alertaDeEvento({ tags: [["empresa_id", "nenhuma"]] }), "d")!;
  assert.equal(semEmpresa.dados.empresa, undefined);
  // id malicioso não entra na chave
  assert.equal(interpretarWebhookDoSentry("event_alert", alertaDeEvento({ issue_id: "1:2' or 1=1", event_id: "" }), "d"), null);
});
