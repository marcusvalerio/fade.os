import { carregarObservabilidade, capturarNoNavegador, sdkCarregado, OBSERVABILIDADE_ATIVA } from "@/lib/observabilidade-navegador";

// O SDK do Sentry sobe depois que a tela fica pronta (ver
// lib/observabilidade-navegador). Erros que acontecem antes disso são
// guardados aqui e entregues quando ele chega; depois, o próprio SDK assume.
if (OBSERVABILIDADE_ATIVA && typeof window !== "undefined") {
  const aoErro = (e: ErrorEvent) => capturarNoNavegador(e.error ?? e.message, "antes-do-sdk");
  const aoRejeitar = (e: PromiseRejectionEvent) => capturarNoNavegador(e.reason, "antes-do-sdk");
  window.addEventListener("error", aoErro);
  window.addEventListener("unhandledrejection", aoRejeitar);

  const carregar = () =>
    carregarObservabilidade().finally(() => {
      window.removeEventListener("error", aoErro);
      window.removeEventListener("unhandledrejection", aoRejeitar);
    });
  if ("requestIdleCallback" in window) window.requestIdleCallback(carregar, { timeout: 4000 });
  else setTimeout(carregar, 2000);
}

// Navegação entre rotas vira transação quando o SDK já está no ar.
export function onRouterTransitionStart(href: string, navigationType: string) {
  sdkCarregado()?.Sentry.captureRouterTransitionStart(href, navigationType);
}
