import { test } from "node:test";
import assert from "node:assert/strict";
import { sinaisDoPulso, agoraEmUmaFrase, type DadosDoPulso } from "./pulso.ts";

const base: DadosDoPulso = {
  emAtendimento: 0, aguardando: 0, restantes: 0, concluidos: 0, atrasados: 0, pendentesConfirmacao: 0,
  atendimentosEsquecidos: 0, caixaAberto: true, atendimentosHoje: 0, clientesParaChamar: 0, estoqueCritico: 0, comissoesDevidas: 0,
};
const brl = (v: number) => `R$ ${v.toFixed(2)}`;

test("sem nada pedindo atenção, nenhum sinal", () => {
  assert.deepEqual(sinaisDoPulso(base, brl), []);
});

test("sinais em ordem de urgência: atraso antes de estoque antes de clientes", () => {
  const s = sinaisDoPulso({ ...base, atrasados: 2, clientesParaChamar: 3, estoqueCritico: 1 }, brl);
  assert.deepEqual(s.map((x) => x.chave), ["atrasados", "estoque", "clientes"]);
  assert.match(s[0].titulo, /2 horários passaram/);
});

test("caixa fechado só vira sinal quando ainda há atendimento pela frente", () => {
  assert.equal(sinaisDoPulso({ ...base, caixaAberto: false }, brl).length, 0);
  assert.equal(sinaisDoPulso({ ...base, caixaAberto: false, restantes: 3 }, brl)[0].chave, "caixa");
});

test("singular e plural", () => {
  assert.match(sinaisDoPulso({ ...base, pendentesConfirmacao: 1 }, brl)[0].titulo, /1 horário de hoje aguarda/);
  assert.match(sinaisDoPulso({ ...base, estoqueCritico: 4 }, brl)[0].titulo, /4 itens no/);
});

test("a frase do agora", () => {
  assert.equal(agoraEmUmaFrase({ ...base, emAtendimento: 1, aguardando: 2 }, { hora: "14:30", cliente: "Ana" }), "1 em atendimento · 2 aguardando · próximo às 14:30");
  assert.equal(agoraEmUmaFrase(base, { hora: "14:30", cliente: "Ana" }), "Ninguém na cadeira agora · próximo às 14:30, Ana");
  assert.equal(agoraEmUmaFrase({ ...base, concluidos: 5 }, null), "Dia sem mais horários · 5 atendimentos concluídos");
  assert.equal(agoraEmUmaFrase(base, null), "Nenhum horário marcado para hoje");
});
