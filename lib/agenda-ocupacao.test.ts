import { test } from "node:test";
import assert from "node:assert/strict";
import { minutosDeJornada, ocupacaoDoDia, formatarDuracao } from "./agenda-ocupacao.ts";

test("jornada é a interseção com o funcionamento da unidade", () => {
  assert.equal(minutosDeJornada({ inicio: "08:00", fim: "21:00" }, { inicio: "09:00:00", fim: "20:00:00" }), 660);
});

test("intervalos saem da jornada, só a parte que cai dentro dela", () => {
  const j = { inicio: "09:00", fim: "18:00" };
  const f = { inicio: "09:00", fim: "18:00" };
  assert.equal(minutosDeJornada(j, f, [{ inicio: "12:00", fim: "13:00" }]), 480);
  assert.equal(minutosDeJornada(j, f, [{ inicio: "17:30", fim: "19:00" }]), 510);
});

test("sem jornada ou sem funcionamento o dia não tem capacidade", () => {
  assert.equal(minutosDeJornada(null, { inicio: "09:00", fim: "18:00" }), 0);
  assert.equal(minutosDeJornada({ inicio: "09:00", fim: "18:00" }, null), 0);
  assert.equal(minutosDeJornada({ inicio: "19:00", fim: "22:00" }, { inicio: "09:00", fim: "18:00" }), 0);
});

test("ocupação soma o marcado e nunca passa de 100%", () => {
  assert.deepEqual(ocupacaoDoDia(480, [60, 30, 30]), { jornadaMin: 480, ocupadoMin: 120, livreMin: 360, pct: 25 });
  assert.equal(ocupacaoDoDia(60, [90]).pct, 100);
  assert.equal(ocupacaoDoDia(0, [30]).pct, null);
});

test("duração no jeito de falar do balcão", () => {
  assert.equal(formatarDuracao(45), "45 min");
  assert.equal(formatarDuracao(180), "3h");
  assert.equal(formatarDuracao(90), "1h30");
});
