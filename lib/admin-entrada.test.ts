import { test } from "node:test";
import assert from "node:assert/strict";
import { destinoDepoisDaEntrada, ehRotaDoAdmin, ehRotaPublicaDoAdmin } from "./admin-entrada.ts";

test("só login e recuperação do Admin são públicas", () => {
  assert.equal(ehRotaPublicaDoAdmin("/admin/login"), true);
  assert.equal(ehRotaPublicaDoAdmin("/admin/esqueci-senha"), true);
  assert.equal(ehRotaPublicaDoAdmin("/admin/redefinir-senha"), true);
  assert.equal(ehRotaPublicaDoAdmin("/admin"), false);
  assert.equal(ehRotaPublicaDoAdmin("/admin/acessos"), false);
  assert.equal(ehRotaPublicaDoAdmin("/admin/login/extra"), false);
});

test("reconhece rotas do Admin sem confundir com prefixos parecidos", () => {
  assert.equal(ehRotaDoAdmin("/admin"), true);
  assert.equal(ehRotaDoAdmin("/admin/usuarios"), true);
  assert.equal(ehRotaDoAdmin("/administracao"), false);
  assert.equal(ehRotaDoAdmin("/agenda"), false);
});

test("destino depois da entrada nunca sai do Admin", () => {
  assert.equal(destinoDepoisDaEntrada("/admin/acessos"), "/admin/acessos");
  assert.equal(destinoDepoisDaEntrada("/admin/empresas/1?x=2"), "/admin/empresas/1?x=2");
  assert.equal(destinoDepoisDaEntrada("https://evil.example"), "/admin");
  assert.equal(destinoDepoisDaEntrada("//evil.example/admin"), "/admin");
  assert.equal(destinoDepoisDaEntrada("/agenda"), "/admin");
  assert.equal(destinoDepoisDaEntrada("/admin/login"), "/admin");
  assert.equal(destinoDepoisDaEntrada(null), "/admin");
});
