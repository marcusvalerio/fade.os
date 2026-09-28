import { test } from "node:test";
import assert from "node:assert/strict";
import { processarFila, type EntregaReservada, type DependenciasDaFila, type StatusRegistrado } from "./fila.ts";
import { ConfiguracaoFcmAusente, type ResultadoDoEnvio } from "./fcm.ts";

function entrega(id: string, token: string, tentativas = 1): EntregaReservada {
  return { entrega_id: id, notificacao_id: "n-" + id, token, titulo: "T", corpo: "C", url: "/agenda", prioridade: "normal", tipo: "agenda.novo", categoria: "agenda", tentativas };
}

function montar(lote: EntregaReservada[], resposta: (token: string) => ResultadoDoEnvio | Error) {
  const registros: [string, StatusRegistrado, string | undefined][] = [];
  const relatos: Record<string, string | number>[] = [];
  const enviados: string[] = [];
  const dep: DependenciasDaFila = {
    reservar: async () => lote,
    registrar: async (id, status, erro) => void registros.push([id, status, erro]),
    enviar: async (m) => {
      enviados.push(m.token);
      const r = resposta(m.token);
      if (r instanceof Error) throw r;
      return r;
    },
    relatar: (_e, c) => void relatos.push(c),
  };
  return { dep, registros, relatos, enviados };
}

test("vários aparelhos da mesma pessoa: um envio por aparelho", async () => {
  const { dep, registros, enviados } = montar([entrega("a", "celular"), entrega("b", "notebook")], () => ({ status: "enviada" }));
  const b = await processarFila(dep);
  assert.deepEqual(enviados, ["celular", "notebook"]);
  assert.equal(b.enviadas, 2);
  assert.deepEqual(registros.map((r) => r[1]), ["enviada", "enviada"]);
});

test("token inválido é registrado como tal (o banco invalida o aparelho) e não vai ao Sentry como defeito", async () => {
  const { dep, registros, relatos } = montar([entrega("a", "morto"), entrega("b", "vivo")], (t) =>
    t === "morto" ? { status: "token_invalido", erro: "404 UNREGISTERED" } : { status: "enviada" }
  );
  const b = await processarFila(dep);
  assert.equal(b.invalidas, 1);
  assert.equal(b.enviadas, 1);
  assert.deepEqual(registros[0], ["a", "token_invalido", "404 UNREGISTERED"]);
  assert.equal(relatos.length, 0);
});

test("falha transitória volta para a fila; na última tentativa vira falha e vai ao Sentry", async () => {
  const { dep, registros, relatos } = montar([entrega("a", "x", 2), entrega("b", "y", 5)], () => ({ status: "tentar_de_novo", erro: "503 UNAVAILABLE" }));
  const b = await processarFila(dep);
  assert.equal(b.adiadas, 1);
  assert.equal(b.falhas, 1);
  assert.deepEqual(registros.map((r) => r[1]), ["pendente", "falhou"]);
  assert.equal(relatos.length, 1);
  assert.equal(relatos[0].operacao, "push.envio");
  assert.equal(relatos[0].tipo, "agenda.novo");
});

test("sem configuração do Firebase: o lote inteiro volta para a fila e o Sentry recebe um aviso só", async () => {
  const { dep, registros, relatos, enviados } = montar([entrega("a", "x"), entrega("b", "y"), entrega("c", "z")], () => new ConfiguracaoFcmAusente("faltando FIREBASE_PRIVATE_KEY"));
  const b = await processarFila(dep);
  assert.equal(b.configuracao, true);
  assert.equal(enviados.length, 1);
  assert.deepEqual(registros.map((r) => r[1]), ["pendente", "pendente", "pendente"]);
  assert.equal(relatos.length, 1);
  assert.equal(relatos[0].operacao, "push.configuracao");
});

test("erro inesperado num envio não para o lote", async () => {
  const { dep, registros } = montar([entrega("a", "x"), entrega("b", "y")], (t) => (t === "x" ? new TypeError("boom") : { status: "enviada" }));
  const b = await processarFila(dep);
  assert.deepEqual(registros.map((r) => r[1]), ["pendente", "enviada"]);
  assert.equal(b.enviadas, 1);
});

test("fila vazia (pessoa sem aparelho: o banco nem cria entrega pendente) não envia nada", async () => {
  const { dep, enviados } = montar([], () => ({ status: "enviada" }));
  const b = await processarFila(dep);
  assert.equal(b.reservadas, 0);
  assert.equal(enviados.length, 0);
});
