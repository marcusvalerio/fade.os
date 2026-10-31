import type { MetadataRoute } from "next";
import { urlDoSite } from "@/lib/site";

/** Só as páginas públicas de produto são indexáveis; o app e o Admin não. */
export default function robots(): MetadataRoute.Robots {
  const site = urlDoSite();
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/beta"],
      disallow: ["/admin", "/api", "/auth", "/onboarding", "/notificacoes", "/agenda", "/login"],
    },
    sitemap: new URL("/sitemap.xml", site).toString(),
  };
}
