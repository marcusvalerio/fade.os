import { withSentryConfig } from "@sentry/nextjs/config";

// Ambiente e release chegam ao navegador em tempo de build. Na Vercel,
// VERCEL_ENV é production | preview | development e VERCEL_GIT_COMMIT_SHA é o
// commit do deploy — a release do Sentry fica amarrada a ele.
const AMBIENTE = process.env.VERCEL_ENV || "development";
const RELEASE = process.env.VERCEL_GIT_COMMIT_SHA || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_CORTEX_AMBIENTE: AMBIENTE,
    NEXT_PUBLIC_CORTEX_RELEASE: RELEASE,
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG || "cortexos",
  project: process.env.SENTRY_PROJECT || "cortex-os",
  // Sem token (local, ou antes de configurar na Vercel) o build segue normal,
  // só não sobe source maps nem cria a release.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  treeshake: { removeDebugLogging: true },
  release: RELEASE ? { name: RELEASE } : undefined,
  // Eventos do navegador passam pelo próprio domínio (bloqueadores de anúncio
  // derrubam o domínio do Sentry). Rota fixa porque o middleware a exclui.
  tunnelRoute: "/monitoramento",
});
