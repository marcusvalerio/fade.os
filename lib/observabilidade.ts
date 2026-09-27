import * as Sentry from "@sentry/nextjs";
import { limparEvento, limparQuebra, limparSpan } from "@/lib/observabilidade-limpeza";

/**
 * Observabilidade do CORTEX (Sentry) — configuração comum a navegador,
 * servidor e edge.
 *
 * Ambientes: development | preview | production, lidos do VERCEL_ENV no
 * build (next.config → NEXT_PUBLIC_CORTEX_AMBIENTE). Em development nada é
 * enviado, a menos que NEXT_PUBLIC_SENTRY_DEV=1 (para testar a integração),
 * e mesmo assim o evento sai marcado como development — não polui produção.
 *
 * Release: o commit do deploy (VERCEL_GIT_COMMIT_SHA). Com SENTRY_AUTH_TOKEN
 * no build, os source maps sobem para essa release.
 *
 * Deliberadamente fora: Session Replay (gravaria a tela, com nome e telefone
 * de clientes) e o widget de feedback do Sentry (as pesquisas do CORTEX
 * cobrem isso, com público definido).
 */
export const AMBIENTE = process.env.NEXT_PUBLIC_CORTEX_AMBIENTE || "development";
export const RELEASE = process.env.NEXT_PUBLIC_CORTEX_RELEASE || undefined;
const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export function opcoesDoSentry(): Parameters<typeof Sentry.init>[0] {
  return {
    dsn: DSN,
    environment: AMBIENTE,
    release: RELEASE,
    enabled: Boolean(DSN) && (AMBIENTE !== "development" || process.env.NEXT_PUBLIC_SENTRY_DEV === "1"),
    // O que o SDK coleta sozinho — fechado por padrão. A limpeza em
    // beforeSend é a segunda camada, para o que escapar daqui.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { allow: ["user-agent", "accept-language", "referer", "content-type"] }, response: false },
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
      genAI: { inputs: false, outputs: false },
      graphQL: { document: false, variables: false },
    },
    tracesSampleRate: AMBIENTE === "production" ? 0.1 : AMBIENTE === "preview" ? 0.3 : 1,
    // Erros que não são defeito: navegação cancelada, extensões, rede do
    // próprio visitante caindo.
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "AbortError",
      "Non-Error promise rejection captured",
    ],
    beforeSend(evento) {
      return limparEvento(evento as never);
    },
    // Desempenho sai como spans (padrão do SDK 11); a limpeza vale igual.
    beforeSendSpan(span) {
      return limparSpan(span);
    },
    beforeBreadcrumb(quebra) {
      // Digitação e cliques não interessam; a rota e as chamadas de rede sim.
      if (quebra.category === "ui.input") return null;
      return limparQuebra(quebra as never);
    },
  };
}

export type ContextoDeUso = {
  usuarioId?: string | null;
  empresaId?: string | null;
  papel?: string | null;
  area?: "produto" | "admin" | "cliente" | "publico";
};

/** Quem está usando — só ids e papel, nunca nome, e-mail ou telefone. */
export function definirContexto(c: ContextoDeUso) {
  Sentry.setUser(c.usuarioId ? { id: c.usuarioId } : null);
  if (c.empresaId !== undefined) Sentry.setTag("empresa_id", c.empresaId ?? "nenhuma");
  if (c.papel !== undefined) Sentry.setTag("papel", c.papel ?? "desconhecido");
  if (c.area) Sentry.setTag("area", c.area);
}

/**
 * Erro inesperado que a interface transformou em mensagem amigável (a
 * ação não estourou, então o onRequestError não vê). Erro de regra de
 * negócio e de permissão NÃO passa por aqui — é resposta esperada, não
 * defeito.
 */
export function reportarErro(erro: unknown, onde: string, extra?: Record<string, string | number | boolean>) {
  Sentry.withScope((escopo) => {
    escopo.setTag("origem", onde);
    if (extra) escopo.setContext("detalhe", extra);
    Sentry.captureException(erro);
  });
}
