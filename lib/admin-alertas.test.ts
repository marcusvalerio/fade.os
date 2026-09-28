import { test } from "node:test";
import assert from "node:assert/strict";
import { gerarAlertas } from "./admin-alertas.ts";

const agora = Date.parse("2026-09-27T12:00:00Z");
const empresa = (o: Record<string, unknown>) => ({
  id: "e1", name: "Barbearia X", status: "active", estado: "ativa", entrou_em: "2026-09-01T00:00:00Z",
  dias_sem_acesso: 0, dias_sem_atividade: 0, beta_expira_em: null, beta_status: null, ...o,
}) as Parameters<typeof gerarAlertas>[0]["empresas"][number];
const semErros = { estado: "ok" as const, resumo: { abertos: 0, novos24h: 0, recorrentes: 0 } };

test("empresa ativa e sem sinais não gera alerta", () => {
  assert.deepEqual(gerarAlertas({ empresas: [empresa({})], betaPendentes: 0, pesquisas: [], erros: semErros }, agora), []);
});

test("uma empresa, um alerta: o mais grave, com os outros sinais no detalhe", () => {
  const a = gerarAlertas({ empresas: [empresa({ estado: "parada", dias_sem_atividade: 20, dias_sem_acesso: 12 })], betaPendentes: 0, pesquisas: [], erros: semErros }, agora);
  assert.equal(a.length, 1);
  assert.equal(a[0].nivel, "importante");
  assert.match(a[0].titulo, /20 dias/);
  assert.match(a[0].detalhe, /ninguém da equipe entra há 12 dias/);
});

test("configuração travada só depois de 3 dias; suspensa e beta revogado nunca alertam", () => {
  const recente = empresa({ estado: "configurando", entrou_em: "2026-09-26T00:00:00Z" });
  const antiga = empresa({ id: "e2", estado: "configurando", entrou_em: "2026-09-20T00:00:00Z" });
  const suspensa = empresa({ id: "e3", status: "suspended", estado: "suspensa", dias_sem_acesso: 40 });
  const revogada = empresa({ id: "e4", estado: "configurando", entrou_em: "2026-09-10T00:00:00Z", beta_status: "revoked" });
  const a = gerarAlertas({ empresas: [recente, antiga, suspensa, revogada], betaPendentes: 0, pesquisas: [], erros: semErros }, agora);
  assert.deepEqual(a.map((x) => x.chave), ["empresa-e2"]);
});

test("erros novos são críticos e vêm primeiro; sem token vira informativo", () => {
  const a = gerarAlertas({ empresas: [], betaPendentes: 2, pesquisas: [], erros: { estado: "ok", resumo: { abertos: 3, novos24h: 1, recorrentes: 2 } } }, agora);
  assert.deepEqual(a.map((x) => x.nivel), ["critico", "importante", "atencao"]);
  const b = gerarAlertas({ empresas: [], betaPendentes: 0, pesquisas: [], erros: { estado: "nao_conectado" } }, agora);
  assert.equal(b[0].nivel, "info");
});

test("beta perto do fim e pesquisa com pouca resposta", () => {
  const a = gerarAlertas({
    empresas: [empresa({ beta_status: "approved", beta_expira_em: "2026-10-05T00:00:00Z" })],
    betaPendentes: 0,
    pesquisas: [
      { id: "p1", titulo: "Agenda", status: "publicada", exibicoes: 20, respostas: 2 },
      { id: "p2", titulo: "Caixa", status: "publicada", exibicoes: 5, respostas: 0 },
    ],
    erros: semErros,
  }, agora);
  assert.deepEqual(a.map((x) => x.chave).sort(), ["empresa-e1", "pesquisa-p1"]);
  assert.match(a.find((x) => x.chave === "empresa-e1")!.titulo, /beta termina em 8 dias/);
});

test("inatividade: 7 dias é atenção, 10 dias é inatividade prolongada (e nunca antes de 7)", () => {
  const alerta = (d: number) => gerarAlertas({ empresas: [empresa({ dias_sem_acesso: d })], betaPendentes: 0, pesquisas: [], erros: semErros }, agora);
  assert.deepEqual(alerta(6), []);
  assert.equal(alerta(7)[0].nivel, "atencao");
  assert.equal(alerta(9)[0].nivel, "atencao");
  assert.equal(alerta(10)[0].nivel, "importante");
  assert.match(alerta(10)[0].titulo, /inatividade prolongada: ninguém da equipe entra há 10 dias/);
});
