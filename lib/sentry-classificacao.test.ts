import { test } from "node:test";
import assert from "node:assert/strict";
import { classificar, lerProblema, resumir } from "./sentry-classificacao.ts";

const agora = Date.parse("2026-09-27T12:00:00Z");
const base = { id: "1", shortId: "CORTEX-OS-1", title: "Error: x", culprit: "/agenda", level: "error", status: "unresolved", count: "2", userCount: 1, permalink: "https://s/1", isUnhandled: true };

test("lê a resposta da API e aceita contagens em texto", () => {
  const p = lerProblema({ ...base, firstSeen: "2026-09-27T10:00:00Z", lastSeen: "2026-09-27T11:00:00Z" });
  assert.equal(p?.ocorrencias, 2);
  assert.equal(p?.rota, "/agenda");
  assert.equal(lerProblema({ title: "sem id" }), null);
});

test("novo = primeira vez nas últimas 24 h; recorrente = dias diferentes ou 5+ vezes", () => {
  const novo = classificar(lerProblema({ ...base, firstSeen: "2026-09-27T01:00:00Z", lastSeen: "2026-09-27T11:00:00Z" })!, agora);
  assert.deepEqual([novo.novo, novo.recorrente], [true, false]);
  const volta = classificar(lerProblema({ ...base, firstSeen: "2026-09-20T01:00:00Z", lastSeen: "2026-09-26T11:00:00Z" })!, agora);
  assert.deepEqual([volta.novo, volta.recorrente], [false, true]);
  const muitas = classificar(lerProblema({ ...base, count: "7", firstSeen: "2026-09-26T08:00:00Z", lastSeen: "2026-09-26T09:00:00Z" })!, agora);
  assert.equal(muitas.recorrente, true);
  const umaVez = classificar(lerProblema({ ...base, count: "1", firstSeen: "2026-09-25T08:00:00Z", lastSeen: "2026-09-25T08:00:00Z" })!, agora);
  assert.deepEqual([umaVez.novo, umaVez.recorrente], [false, false]);
});

test("resumo conta só os abertos", () => {
  const a = classificar(lerProblema({ ...base, firstSeen: "2026-09-27T01:00:00Z", lastSeen: "2026-09-27T11:00:00Z" })!, agora);
  const r = classificar(lerProblema({ ...base, id: "2", status: "resolved", firstSeen: "2026-09-27T01:00:00Z", lastSeen: "2026-09-27T11:00:00Z" })!, agora);
  assert.deepEqual(resumir([a, r]), { abertos: 1, novos24h: 1, recorrentes: 0, ocorrencias: 2 });
});
