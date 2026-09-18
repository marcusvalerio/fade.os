import { test } from "node:test";
import assert from "node:assert/strict";
import type { User } from "@supabase/supabase-js";
import { toIdentity } from "./to-identity.ts";

// Só os campos que toIdentity lê — o resto de `User` não importa aqui.
function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "dona@example.com",
    user_metadata: {},
    app_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as User;
}

test("toIdentity: usuário com nome e e-mail", () => {
  const identity = toIdentity(fakeUser({ user_metadata: { name: "Marcus" } }));
  assert.deepEqual(identity, { id: "user-1", email: "dona@example.com", name: "Marcus" });
});

test("toIdentity: nome com espaços é aparado", () => {
  const identity = toIdentity(fakeUser({ user_metadata: { name: "  Marcus  " } }));
  assert.equal(identity.name, "Marcus");
});

test("toIdentity: nome vazio ou só espaços vira null, não string vazia", () => {
  assert.equal(toIdentity(fakeUser({ user_metadata: { name: "   " } })).name, null);
  assert.equal(toIdentity(fakeUser({ user_metadata: { name: "" } })).name, null);
});

test("toIdentity: sem user_metadata.name vira null", () => {
  const identity = toIdentity(fakeUser({ user_metadata: {} }));
  assert.equal(identity.name, null);
});

test("toIdentity: e-mail ausente vira null, nunca undefined", () => {
  const identity = toIdentity(fakeUser({ email: undefined }));
  assert.equal(identity.email, null);
});

test("toIdentity: id sempre repassado como veio do Supabase", () => {
  const identity = toIdentity(fakeUser({ id: "5f2b..." }));
  assert.equal(identity.id, "5f2b...");
});
