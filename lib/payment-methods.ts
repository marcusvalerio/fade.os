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
