import { test } from "node:test";
import assert from "node:assert/strict";
import { estadoDoDia, variacao, textoDaVariacao, ritmoDaMeta, proporcao, reposicao } from "./inicio.ts";

const zero = { total: 0, restantes: 0, emAtendimento: 0, aguardando: 0, concluidos: 0, atrasados: 0, esperandoMuito: 0 };

test("estado do dia: cliente esperando vence tudo", () => {
  assert.equal(estadoDoDia({ ...zero, total: 5, emAtendimento: 2, esperandoMuito: 1 }).titulo, "Tem cliente esperando.");
  assert.equal(estadoDoDia({ ...zero, total: 5, atrasados: 1 }).tom, "atencao");
});

test("estado do dia: livre, encerrado, em andamento, pela frente", () => {
  assert.equal(estadoDoDia(zero).titulo, "Agenda livre hoje.");
  assert.equal(estadoDoDia({ ...zero, total: 3, concluidos: 3 }).titulo, "Dia encerrado.");
  assert.equal(estadoDoDia({ ...zero, total: 3, emAtendimento: 1, restantes: 2 }).titulo, "Operação em andamento.");
  assert.equal(estadoDoDia({ ...zero, total: 3, restantes: 3 }).titulo, "Dia pela frente.");
});

test("variação: sem base não inventa porcentagem", () => {
  assert.deepEqual(variacao(100, 0), { tipo: "sem-base" });
  assert.deepEqual(variacao(100, null), { tipo: "sem-base" });
  assert.equal(textoDaVariacao(variacao(100, 0)), "sem período anterior para comparar");
});

test("variação: sobe, cai e igual", () => {
  assert.deepEqual(variacao(120, 100), { tipo: "subiu", pct: 20 });
  assert.deepEqual(variacao(75, 100), { tipo: "caiu", pct: 25 });
  assert.deepEqual(variacao(100.2, 100), { tipo: "igual" });
  assert.equal(textoDaVariacao(variacao(120, 100)), "↑ 20% vs período anterior");
});

test("ritmo da meta: projeção linear do mês e quanto falta", () => {
  assert.deepEqual(ritmoDaMeta(3000, 10000, 10, 30), { pct: 30, projecao: 9000, falta: 7000 });
  assert.deepEqual(ritmoDaMeta(12000, 10000, 20, 30)?.falta, 0);
  assert.equal(ritmoDaMeta(3000, 0, 10, 30), null);
});

test("proporção e reposição", () => {
  assert.equal(proporcao(30, 120), 25);
  assert.equal(proporcao(5, 0), null);
  assert.equal(proporcao(200, 100), 100);
  assert.deepEqual(reposicao(2, 5), { tipo: "repor", quantidade: 3 });
  assert.deepEqual(reposicao(0, 0), { tipo: "zerado" });
});
