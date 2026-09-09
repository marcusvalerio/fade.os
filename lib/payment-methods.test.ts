import test from "node:test";
import assert from "node:assert/strict";

import {
  PAYMENT_METHOD_KEYS,
  requiresOpenCashSession,
  selectablePaymentMethods,
} from "./payment-methods.ts";
import type { PaymentMethodKey } from "./types.ts";

const TODAS: PaymentMethodKey[] = [...PAYMENT_METHOD_KEYS];

test("só dinheiro entra na gaveta, então só ele exige caixa aberto", () => {
  assert.equal(requiresOpenCashSession("cash"), true);
  for (const method of TODAS.filter((m) => m !== "cash")) {
    assert.equal(requiresOpenCashSession(method), false, `${method} não deveria exigir caixa`);
  }
});

test("crédito parcelado segue tratado como pagamento à vista", () => {
  // Esta rodada não inventa parcela nem recebível: se um dia inventar, este
  // teste falha e obriga a decisão a ser explícita.
  assert.equal(requiresOpenCashSession("credit_installments"), false);
});

test("com caixa aberto, todas as formas ativas ficam disponíveis", () => {
  assert.deepEqual(selectablePaymentMethods(TODAS, true), TODAS);
});

test("com caixa fechado, dinheiro sai da lista e o resto fica", () => {
  assert.deepEqual(
    selectablePaymentMethods(TODAS, false),
    TODAS.filter((m) => m !== "cash")
  );
});

test("formas inativas não aparecem, com ou sem caixa", () => {
  const ativas: PaymentMethodKey[] = ["cash", "pix"];
  assert.deepEqual(selectablePaymentMethods(ativas, true), ["cash", "pix"]);
  assert.deepEqual(selectablePaymentMethods(ativas, false), ["pix"]);
});

test("barbearia que só aceita dinheiro fica sem opção com o caixa fechado", () => {
  // É o caso que a tela precisa explicar em vez de deixar finalizar.
  assert.deepEqual(selectablePaymentMethods(["cash"], false), []);
  assert.deepEqual(selectablePaymentMethods(["cash"], true), ["cash"]);
});

test("a ordem de exibição é sempre a mesma, não a da consulta", () => {
  const foraDeOrdem: PaymentMethodKey[] = ["credit", "cash", "pix"];
  assert.deepEqual(selectablePaymentMethods(foraDeOrdem, true), ["cash", "pix", "credit"]);
});
