import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PREFERENCIAS,
  TIPOS_COMUNICAVEIS,
  destinoSeguro,
  quandoRelativo,
  grupoDoDia,
  rotuloDoSino,
  textoDoBadge,
  descricaoDaPreferencia,
  PREFERENCIA_POR_CHAVE,
} from "./catalogo.ts";

// Lê o catálogo direto das migrations: se alguém criar um tipo no banco e
// esquecer a interface (ou o contrário), o teste pega.
function tiposDasMigrations() {
  const sql = ["20260930100000_notificacoes_base.sql", "20260930110000_notificacoes_eventos.sql"]
    .map((f) => readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), "utf8"))
    .join("\n");
  const linhas = [...sql.matchAll(/\(\s*'([a-z_.]+)',\s*'([a-z]+)',\s*'([a-z_.]+)',\s*'([a-z]+)',\s*(true|false),\s*(true|false),\s*'\{([a-z,]+)\}',\s*(true|false),\s*(true|false)/g)];
  return linhas.map((m) => ({ chave: m[1], categoria: m[2], preferencia: m[3], prioridade: m[4], obrigatoria: m[5] === "true", comunicavel: m[9] === "true" }));
}

test("toda preferência do banco tem nome na interface, e vice-versa", () => {
  const tipos = tiposDasMigrations();
  assert.ok(tipos.length >= 20, `achou ${tipos.length} tipos`);
  const doBanco = new Set(tipos.map((t) => t.preferencia));
  const daTela = new Set(PREFERENCIAS.map((p) => p.chave));
  assert.deepEqual([...doBanco].filter((p) => !daTela.has(p)), []);
  assert.deepEqual([...daTela].filter((p) => !doBanco.has(p)), []);
});

test("obrigatórias e categorias batem com o banco", () => {
  for (const t of tiposDasMigrations()) {
    const p = PREFERENCIA_POR_CHAVE.get(t.preferencia)!;
    assert.equal(p.categoria, t.categoria, t.chave);
    if (t.obrigatoria) assert.equal(p.obrigatoria, true, `${t.preferencia} é obrigatória no banco`);
  }
  // pesquisa, novidade e beta são sempre opcionais (não é marketing forçado)
  for (const k of ["produto.pesquisas", "produto.novidades", "produto.beta"]) assert.notEqual(PREFERENCIA_POR_CHAVE.get(k)?.obrigatoria, true);
});

test("critical não é usado por nenhum tipo automático", () => {
  assert.deepEqual(tiposDasMigrations().filter((t) => t.prioridade === "critical"), []);
});

test("Admin só dispara tipos marcados como comunicáveis no banco", () => {
  const comunicaveis = new Set(tiposDasMigrations().filter((t) => t.comunicavel).map((t) => t.chave));
  for (const t of TIPOS_COMUNICAVEIS) assert.ok(comunicaveis.has(t.chave), t.chave);
});

test("destino: só caminho interno", () => {
  assert.equal(destinoSeguro("/agenda?date=2026-09-28"), "/agenda?date=2026-09-28");
  for (const ruim of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", " /x y", "", null]) {
    assert.equal(destinoSeguro(ruim as string), null, String(ruim));
  }
});

test("tempo relativo e grupos do dia no fuso de São Paulo", () => {
  const agora = new Date("2026-09-28T15:00:00Z"); // 12:00 em SP
  assert.equal(quandoRelativo("2026-09-28T14:59:30Z", agora), "Agora");
  assert.equal(quandoRelativo("2026-09-28T14:56:00Z", agora), "Há 4 min");
  assert.equal(quandoRelativo("2026-09-28T14:00:00Z", agora), "Há 1 h");
  assert.equal(quandoRelativo("2026-09-27T20:00:00Z", agora), "Ontem");
  assert.equal(grupoDoDia("2026-09-28T03:30:00Z", agora), "Hoje"); // 00:30 em SP
  assert.equal(grupoDoDia("2026-09-28T02:30:00Z", agora), "Ontem"); // 23:30 do dia 27 em SP
  assert.equal(grupoDoDia("2026-09-24T12:00:00Z", agora), "Esta semana");
  assert.equal(grupoDoDia("2026-09-01T12:00:00Z", agora), "Anteriores");
});

test("sino: rótulo acessível e badge", () => {
  assert.equal(rotuloDoSino(0), "Notificações");
  assert.equal(rotuloDoSino(1), "Notificações, 1 não lida");
  assert.equal(rotuloDoSino(7), "Notificações, 7 não lidas");
  assert.equal(textoDoBadge(0), null);
  assert.equal(textoDoBadge(120), "99+");
});

test("descrição por papel: profissional lê o texto dele", () => {
  const p = PREFERENCIA_POR_CHAVE.get("agenda.novos")!;
  assert.match(descricaoDaPreferencia(p, ["profissional"]), /sua agenda/);
  assert.equal(descricaoDaPreferencia(p, ["gestor", "profissional"]), p.descricao.padrao);
});
