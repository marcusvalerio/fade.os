import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

// Erros de Server Components, Route Handlers, Server Actions e middleware
// que estouram até o Next.
export const onRequestError = Sentry.captureRequestError;
