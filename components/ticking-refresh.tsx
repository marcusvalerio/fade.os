"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Nenhuma escrita no banco acontece só porque o tempo passou — mas "8 min
 * acima do previsto" precisa envelhecer na tela mesmo assim. Isto só gira
 * enquanto `active` for true (um item em andamento); sem item ativo, não há
 * intervalo nenhum rodando.
 */
export function TickingRefresh({ active, intervalMs = 30000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);

  return null;
}
