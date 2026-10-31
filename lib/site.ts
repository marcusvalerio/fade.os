/**
 * Endereço público do CORTEX.OS — base para metadados (Open Graph, sitemap,
 * robots). Ordem: NEXT_PUBLIC_SITE_URL (definido no deploy), o domínio de
 * produção da Vercel, e localhost no desenvolvimento.
 */
export function urlDoSite(): URL {
  const explicito = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicito) return new URL(explicito);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}
