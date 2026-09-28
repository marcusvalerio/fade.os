import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularAdocao, funilDoBeta, nivelDeInatividade } from "./admin-saude.ts";

const e = (o: Record<string, unknown>) => ({
  id: "e1", name: "Barbearia", status: "active", estado: "ativa", origem: "convite_beta", beta_status: "approved",
  dias_sem_acesso: 1, ultimo_acesso: "2026-09-27T00:00:00Z", ...o,
}) as Parameters<typeof calcularAdocao>[0][number];
const m = (id: string, ag: number, at = 0) => ({ id, agendamentos_periodo: ag, atendimentos_periodo: at });

test("inatividade: 7 dias atenção, 10 prolongada, sem acesso nunca", () => {
  assert.equal(nivelDeInatividade(6, "x"), "ok");
  assert.equal(nivelDeInatividade(7, "x"), "atencao");
  assert.equal(nivelDeInatividade(9, "x"), "atencao");
  assert.equal(nivelDeInatividade(10, "x"), "prolongada");
  assert.equal(nivelDeInatividade(null, null), "nunca_entrou");
});

test("7 e 10 dias ficam em faixas separadas; suspensa e revogada fora", () => {
  const a = calcularAdocao([
    e({ id: "a", dias_sem_acesso: 8 }),
    e({ id: "b", dias_sem_acesso: 12 }),
    e({ id: "c", status: "suspended", estado: "suspensa", dias_sem_acesso: 30 }),
    e({ id: "d", beta_status: "revoked", dias_sem_acesso: 30 }),
  ], [], []);
  assert.equal(a.total, 2);
  assert.deepEqual(a.semAcesso7.map((x) => x.id), ["a"]);
  assert.deepEqual(a.semAcesso10.map((x) => x.id), ["b"]);
  assert.match(a.semAcesso10[0].detalhe, /12 dias/);
});

test("beta sem uso, pararam e onboarding pendente", () => {
  const a = calcularAdocao([
    e({ id: "s", estado: "sem_uso" }),
    e({ id: "s2", estado: "sem_uso", origem: "cadastro_direto" }),
    e({ id: "p", estado: "parada" }),
    e({ id: "o", estado: "configurando" }),
  ], [], []);
  assert.deepEqual(a.betaSemUso.map((x) => x.id), ["s"]);
  assert.deepEqual(a.pararam.map((x) => x.id), ["p"]);
  assert.deepEqual(a.onboardingPendente.map((x) => x.id), ["o"]);
});

test("queda relevante: semana anterior com movimento e esta com metade ou menos", () => {
  const empresas = [e({ id: "q" }), e({ id: "estavel" }), e({ id: "pouco" })];
  // semana = últimos 7 dias; quinzena = últimos 14 (anterior = diferença)
  const a = calcularAdocao(empresas, [m("q", 2), m("estavel", 8), m("pouco", 0)], [m("q", 12), m("estavel", 16), m("pouco", 3)]);
  assert.deepEqual(a.quedaDeUso.map((x) => x.id), ["q"]);
  assert.match(a.quedaDeUso[0].detalhe, /2 registros nesta semana contra 10/);
});

test("funil do Beta: pedido → recebeu → utilizou → parou → feedback", () => {
  const f = funilDoBeta({ pending: 1, approved: 3, rejected: 1, revoked: 1 }, [
    { origem: "convite_beta", estado: "ativa", pesquisas_respondidas: 2, beta_status: "approved" },
    { origem: "convite_beta", estado: "parada", pesquisas_respondidas: 0, beta_status: "approved" },
    { origem: "convite_beta", estado: "sem_uso", pesquisas_respondidas: 0, beta_status: "approved" },
    { origem: "convite_beta", estado: "ativa", pesquisas_respondidas: 0, beta_status: "revoked" },
    { origem: "cadastro_direto", estado: "ativa", pesquisas_respondidas: 1, beta_status: null },
  ]);
  assert.deepEqual(f.map((x) => [x.chave, x.valor]), [["pedidos", 6], ["aprovadas", 3], ["usaram", 2], ["pararam", 1], ["feedback", 1]]);
});
