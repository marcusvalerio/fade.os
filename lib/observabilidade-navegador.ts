import type { ContextoDeUso } from "@/lib/observabilidade";
import type { SdkCarregado } from "@/lib/observabilidade-sdk-navegador";

/**
 * Fachada leve do Sentry no navegador. O SDK pesa ~65 kB e entraria em
 * TODA página (inclusive a de agendamento do cliente, no celular); aqui ele
 * é baixado só depois que a tela ficou pronta. Até lá, erros e contexto
 * ficam numa fila curta e são entregues assim que o SDK sobe.
 *
 * Sem DSN, ou em development sem NEXT_PUBLIC_SENTRY_DEV=1, nada é baixado.
 */
const AMBIENTE = process.env.NEXT_PUBLIC_CORTEX_AMBIENTE || "development";
export const OBSERVABILIDADE_ATIVA =
  Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN) &&
  (AMBIENTE !== "development" || process.env.NEXT_PUBLIC_SENTRY_DEV === "1");

const LIMITE_DA_FILA = 30;
let sdk: SdkCarregado | null = null;
let carregamento: Promise<SdkCarregado | null> | null = null;
// Contexto entra antes dos erros ao esvaziar a fila: um erro que aconteceu
// antes da hidratação ainda sai marcado com usuário e empresa.
const filaDeContexto: ((s: SdkCarregado) => void)[] = [];
const fila: ((s: SdkCarregado) => void)[] = [];

function quandoPronto(acao: (s: SdkCarregado) => void, destino = fila) {
  if (!OBSERVABILIDADE_ATIVA) return;
  if (sdk) return acao(sdk);
  if (destino.length < LIMITE_DA_FILA) destino.push(acao);
}

export function carregarObservabilidade(): Promise<SdkCarregado | null> {
  if (!OBSERVABILIDADE_ATIVA) return Promise.resolve(null);
  carregamento ??= import("@/lib/observabilidade-sdk-navegador")
    .then((m) => {
      sdk = m.iniciar();
      for (const acao of [...filaDeContexto.splice(0), ...fila.splice(0)]) acao(sdk);
      return sdk;
    })
    .catch(() => null);
  return carregamento;
}

export function sdkCarregado() {
  return sdk;
}

export function capturarNoNavegador(erro: unknown, origem: string) {
  quandoPronto((s) => s.Sentry.captureException(erro, { tags: { origem } }));
}

export function contextoNoNavegador(c: ContextoDeUso) {
  quandoPronto((s) => s.definirContexto(c), filaDeContexto);
}
