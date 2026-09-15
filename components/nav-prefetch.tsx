"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { NavScope } from "@/components/app-nav";

const ROUTES: Record<NavScope, string[]> = {
  manager: [
    "/dashboard",
    "/agenda",
    "/atendimento",
    "/clientes",
    "/pdv",
    "/vendas",
    "/caixa",
    "/servicos",
    "/produtos",
    "/estoque",
    "/profissionais",
    "/comissoes",
    "/financeiro",
    "/configuracoes",
  ],
  reception: [
    "/agenda",
    "/atendimento",
    "/pdv",
    "/caixa",
    "/clientes",
  ],
  barber: [
    "/agenda",
    "/atendimento",
    "/clientes",
  ],
};

/**
 * Preaquece as rotas primárias durante o tempo ocioso depois que o shell
 * montou. O clique continua sendo navegação normal; a diferença é que o
 * RSC payload da próxima tela já pode estar no cache do router.
 */
export function NavPrefetch({ scope }: { scope: NavScope }) {
  const router = useRouter();

  useEffect(() => {
    const routes = ROUTES[scope];
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      for (const route of routes) router.prefetch(route);
    };

    const idle = window.requestIdleCallback?.(run, { timeout: 1200 });
    if (idle === undefined) {
      const timer = window.setTimeout(run, 120);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    return () => {
      cancelled = true;
      window.cancelIdleCallback?.(idle);
    };
  }, [router, scope]);

  return null;
}
