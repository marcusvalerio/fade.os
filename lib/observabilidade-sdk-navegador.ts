import * as Sentry from "@sentry/nextjs";
import { opcoesDoSentry, definirContexto } from "@/lib/observabilidade";

/**
 * Pedaço carregado sob demanda no navegador (ver observabilidade-navegador):
 * o SDK do Sentry só chega depois que a tela já está pronta.
 */
export function iniciar() {
  Sentry.init(opcoesDoSentry());
  return { Sentry, definirContexto };
}

export type SdkCarregado = ReturnType<typeof iniciar>;
