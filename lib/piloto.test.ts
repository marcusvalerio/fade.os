import { test } from "node:test";
import assert from "node:assert/strict";
import {
  diaDoPiloto,
  rotuloDoDia,
  variacao,
  mediaAnterior,
  desdeODiaZero,
  somaNoPiloto,
  horasNoPiloto,
  modulosNoPiloto,
  diasSemUso,
  linhaDoTempo,
  type SnapshotDoPiloto,
  type MetricasDoDia,
} from "./piloto.ts";

function snap(dia: string, n: number, m: Partial<MetricasDoDia> & Record<string, unknown> = {}): SnapshotDoPiloto {
  return {
    dia,
    dia_do_piloto: n,
    final: true,
    atrasado: false,
    capturado_em: `${dia}T23:00:00Z`,
    metricas: {
      operacoes: 0,
      modulos: {},
      horas: Array(24).fill(0),
      horas_sessao: Array(24).fill(0),
      usuarios: { ativos: 0 },
      acumulado: { vendas: 0, valor_vendido: 0 },
      inatividade: { sem_uso_no_dia: false },
      ...m,
    } as unknown as MetricasDoDia,
  };
}

test("dia do piloto: Dia 0 na véspera, 1..14 no período, fora dele", () => {
  // Norte 21: 29/09 a 12/10
  assert.deepEqual(diaDoPiloto("2026-09-29", "2026-10-12", "2026-09-27"), { dia: 0, total: 14, fase: "antes" });
  assert.deepEqual(diaDoPiloto("2026-09-29", "2026-10-12", "2026-09-28"), { dia: 0, total: 14, fase: "dia0" });
  assert.deepEqual(diaDoPiloto("2026-09-29", "2026-10-12", "2026-09-29"), { dia: 1, total: 14, fase: "andamento" });
  assert.deepEqual(diaDoPiloto("2026-09-29", "2026-10-12", "2026-10-01"), { dia: 3, total: 14, fase: "andamento" });
  assert.deepEqual(diaDoPiloto("2026-09-29", "2026-10-12", "2026-10-12"), { dia: 14, total: 14, fase: "andamento" });
  assert.deepEqual(diaDoPiloto("2026-09-29", "2026-10-12", "2026-10-20"), { dia: 14, total: 14, fase: "depois" });
  assert.equal(rotuloDoDia(0, 14), "Dia 0 (base)");
  assert.equal(rotuloDoDia(5, 14), "Dia 5/14");
});

test("linha do tempo tem Dia 0 + 14 dias e marca os retratos existentes", () => {
  const l = linhaDoTempo("2026-09-29", "2026-10-12", [snap("2026-09-28", 0), snap("2026-09-30", 2)]);
  assert.equal(l.length, 15);
  assert.equal(l[0].dia, "2026-09-28");
  assert.equal(l[14].dia, "2026-10-12");
  assert.deepEqual(l.filter((x) => x.snapshot).map((x) => x.n), [0, 2]);
});

test("variação: sem base não inventa percentual", () => {
  assert.deepEqual(variacao(6, 4), { delta: 2, pct: 50 });
  assert.deepEqual(variacao(0, 4), { delta: -4, pct: -100 });
  assert.deepEqual(variacao(3, 0), { delta: 3, pct: null });
  assert.equal(variacao(3, null), null);
});

test("média anterior ignora o Dia 0 e o próprio dia", () => {
  const s = [
    snap("2026-09-28", 0, { operacoes: 100 }),
    snap("2026-09-29", 1, { operacoes: 4 }),
    snap("2026-09-30", 2, { operacoes: 8 }),
    snap("2026-10-01", 3, { operacoes: 1 }),
  ];
  assert.equal(mediaAnterior(s, "2026-10-01", (m) => m.operacoes), 6);
  assert.equal(mediaAnterior(s, "2026-09-29", (m) => m.operacoes), null);
});

test("evolução desde o Dia 0 usa o acumulado (o histórico antigo não conta como piloto)", () => {
  const s = [
    snap("2026-09-28", 0, { acumulado: { vendas: 81, valor_vendido: 4321 } } as never),
    snap("2026-09-29", 1, { acumulado: { vendas: 84, valor_vendido: 4500 } } as never),
    snap("2026-09-30", 2, { acumulado: { vendas: 90, valor_vendido: 4800 } } as never),
  ];
  assert.equal(desdeODiaZero(s, (m) => m.acumulado.vendas), 9);
  assert.equal(desdeODiaZero(s, (m) => m.acumulado.valor_vendido), 479);
  assert.equal(desdeODiaZero([s[0]], (m) => m.acumulado.vendas), null);
});

test("somas, horários e módulos só contam os dias do piloto", () => {
  const h = Array(24).fill(0);
  h[10] = 3;
  const s = [
    snap("2026-09-28", 0, { operacoes: 50, horas: Array(24).fill(9), modulos: { Agenda: 50 } }),
    snap("2026-09-29", 1, { operacoes: 3, horas: h, modulos: { Agenda: 2, Caixa: 1 } }),
    snap("2026-09-30", 2, { operacoes: 2, horas: h, modulos: { Agenda: 2 } }),
  ];
  assert.equal(somaNoPiloto(s, (m) => m.operacoes), 5);
  assert.equal(horasNoPiloto(s, "horas")[10], 6);
  assert.equal(horasNoPiloto(s, "horas")[3], 0);
  assert.deepEqual(modulosNoPiloto(s), [
    { modulo: "Agenda", registros: 4, dias: 2 },
    { modulo: "Caixa", registros: 1, dias: 1 },
  ]);
});

test("dias sem uso e maior sequência de inatividade", () => {
  const parado = { inatividade: { sem_uso_no_dia: true } } as never;
  const s = [
    snap("2026-09-28", 0, parado),
    snap("2026-09-29", 1, parado),
    snap("2026-09-30", 2),
    snap("2026-10-01", 3, parado),
    snap("2026-10-02", 4, parado),
    snap("2026-10-03", 5, parado),
  ];
  assert.deepEqual(diasSemUso(s), { dias: 4, maiorSequencia: 3 });
});
