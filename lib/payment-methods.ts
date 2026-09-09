import type { PaymentMethodKey } from "@/lib/types";

/**
 * Um arquivo "use server" só pode exportar funções async — qualquer export
 * que não seja função (como estas constantes) não atravessa a fronteira
 * server/client como o valor real: o Next.js as trata como referência de
 * Server Action, então em componente client elas chegam em formato
 * incompatível com o que o código espera (ex.: PAYMENT_METHOD_KEYS deixa de
 * ser um array). Por isso essas constantes vivem num módulo comum, fora de
 * actions/pagamentos.ts, e são importadas daqui tanto por Server Actions
 * quanto por componentes client.
 */
export const PAYMENT_METHOD_LABEL: Record<PaymentMethodKey, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit: "Débito",
  credit: "Crédito",
  credit_installments: "Crédito parcelado",
};

export const PAYMENT_METHOD_KEYS: PaymentMethodKey[] = [
  "cash",
  "pix",
  "debit",
  "credit",
  "credit_installments",
];

/**
 * Dinheiro é a única forma que entra fisicamente na gaveta, e por isso a
 * única que exige uma sessão de caixa aberta. Cartão e PIX guardam a sessão
 * quando existe — ajuda a conferir o turno — mas não dependem dela.
 *
 * "Crédito parcelado" segue tratado como pagamento à vista, exatamente como
 * hoje: nada aqui inventa parcela, recebível ou taxa.
 *
 * Esta regra tem uma gêmea no banco, no trigger
 * `payment_requires_open_cash_session`. Lá é a garantia; aqui é só para a
 * tela não oferecer o que o backend vai recusar.
 */
export function requiresOpenCashSession(method: PaymentMethodKey): boolean {
  return method === "cash";
}

/** As formas que a pessoa pode de fato escolher agora. */
export function selectablePaymentMethods(
  activeMethods: PaymentMethodKey[],
  cashSessionOpen: boolean
): PaymentMethodKey[] {
  return PAYMENT_METHOD_KEYS.filter(
    (method) =>
      activeMethods.includes(method) && (cashSessionOpen || !requiresOpenCashSession(method))
  );
}
