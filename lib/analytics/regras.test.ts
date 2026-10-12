import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ambienteDoHost,
  aparelhoDoUserAgent,
  caminhoLimpo,
  canalDaVisita,
  consentimentoEfetivo,
  deveMostrarFaixa,
  dominioDeReferencia,
  ehEventoValido,
  ehPaginaDeAquisicao,
  ehRobo,
  eventoDoClique,
  lerUtm,
} from "./regras.ts";

test("ambiente: só o domínio oficial é produção; Preview e localhost nunca contaminam", () => {
  assert.equal(ambienteDoHost("fadeos-five.vercel.app"), "producao");
  assert.equal(ambienteDoHost("FADEOS-FIVE.vercel.app:443"), "producao");
  assert.equal(ambienteDoHost("cortex-os-git-claude-x-meji-projects.vercel.app"), "preview");
  assert.equal(ambienteDoHost("localhost:3000"), "local");
  assert.equal(ambienteDoHost("127.0.0.1"), "local");
  assert.equal(ambienteDoHost(""), "local");
});

test("só /, /beta e /login são medidas", () => {
  assert.equal(ehPaginaDeAquisicao("/"), true);
  assert.equal(ehPaginaDeAquisicao("/beta"), true);
  assert.equal(ehPaginaDeAquisicao("/login"), true);
  assert.equal(ehPaginaDeAquisicao("/agenda"), false);
  assert.equal(ehPaginaDeAquisicao("/norte-21"), false);
  assert.equal(ehPaginaDeAquisicao("/admin"), false);
});

test("caminho nunca leva query string nem hash", () => {
  assert.equal(caminhoLimpo("https://fadeos-five.vercel.app/beta?utm_source=ig&email=a@b.com#x"), "/beta");
  assert.equal(caminhoLimpo("/login/"), "/login");
  assert.equal(caminhoLimpo("/?a=1"), "/");
});

test("UTM: só as cinco chaves, limpas; o resto da query é descartado", () => {
  assert.deepEqual(lerUtm("?utm_source=Instagram&utm_medium=stories&email=x@y.com&token=abc"), {
    utm_source: "instagram",
    utm_medium: "stories",
  });
  assert.deepEqual(lerUtm("utm_campaign=<script>lancamento</script>"), { utm_campaign: "scriptlancamentoscript" });
  assert.equal((lerUtm(`utm_term=${"a".repeat(300)}`).utm_term ?? "").length, 100);
});

test("referência: só o domínio, sem www, e nunca a própria página", () => {
  assert.equal(dominioDeReferencia("https://www.google.com.br/search?q=barbearia+sistema"), "google.com.br");
  assert.equal(dominioDeReferencia("https://l.instagram.com/?u=x"), "l.instagram.com");
  assert.equal(dominioDeReferencia("https://fadeos-five.vercel.app/", "fadeos-five.vercel.app"), null);
  assert.equal(dominioDeReferencia("isto não é url"), null);
  assert.equal(dominioDeReferencia(""), null);
});

test("canal", () => {
  assert.equal(canalDaVisita(null, {}), "direto");
  assert.equal(canalDaVisita("google.com.br", {}), "busca_organica");
  assert.equal(canalDaVisita("l.instagram.com", {}), "instagram");
  assert.equal(canalDaVisita(null, { utm_source: "instagram" }), "instagram");
  assert.equal(canalDaVisita(null, { utm_source: "whatsapp" }), "whatsapp");
  assert.equal(canalDaVisita("lm.facebook.com", {}), "facebook");
  assert.equal(canalDaVisita(null, { utm_source: "instagram", utm_medium: "cpc" }), "campanha");
  assert.equal(canalDaVisita(null, { utm_source: "google", utm_medium: "cpc" }), "campanha");
  assert.equal(canalDaVisita("t.co", {}), "outras_redes");
  assert.equal(canalDaVisita("blogdobarbeiro.com.br", {}), "referencia");
  assert.equal(canalDaVisita(null, { utm_campaign: "outubro" }), "campanha");
});

test("aparelho: categoria, navegador e sistema", () => {
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  assert.deepEqual(aparelhoDoUserAgent(iphone), { dispositivo: "celular", navegador: "Safari", sistema: "iOS" });
  const android = "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
  assert.deepEqual(aparelhoDoUserAgent(android), { dispositivo: "celular", navegador: "Chrome", sistema: "Android" });
  const win = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0";
  assert.deepEqual(aparelhoDoUserAgent(win), { dispositivo: "computador", navegador: "Edge", sistema: "Windows" });
  const ipad = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1";
  assert.equal(aparelhoDoUserAgent(ipad).dispositivo, "tablet");
});

test("robôs e pré-visualização de link não contam", () => {
  assert.equal(ehRobo("Googlebot/2.1"), true);
  assert.equal(ehRobo("WhatsApp/2.23.20.0"), true);
  assert.equal(ehRobo("Mozilla/5.0 HeadlessChrome/126"), true);
  assert.equal(ehRobo(""), true);
  assert.equal(ehRobo("Mozilla/5.0 (Windows NT 10.0) Chrome/126"), false);
});

test("consentimento: GPC/DNT valem como recusa; faixa só para quem não respondeu", () => {
  assert.equal(consentimentoEfetivo("aceito", { gpc: true }), "recusado");
  assert.equal(consentimentoEfetivo("aceito", { dnt: "1" }), "recusado");
  assert.equal(consentimentoEfetivo("aceito", {}), "aceito");
  assert.equal(consentimentoEfetivo(null, {}), "indefinido");
  assert.equal(consentimentoEfetivo("qualquer", {}), "indefinido");
  assert.equal(deveMostrarFaixa("indefinido"), true);
  assert.equal(deveMostrarFaixa(consentimentoEfetivo(null, { gpc: true })), false);
});

test("eventos: lista fechada, e o clique vira evento só pelo destino", () => {
  assert.equal(ehEventoValido("cta_click"), true);
  assert.equal(ehEventoValido("click_qualquer"), false);
  assert.equal(eventoDoClique("/beta"), "cta_click");
  assert.equal(eventoDoClique("/beta?utm_source=x"), "cta_click");
  assert.equal(eventoDoClique("https://wa.me/5511999999999?text=oi"), "whatsapp_click");
  assert.equal(eventoDoClique("/login"), null);
  assert.equal(eventoDoClique(null), null);
});
