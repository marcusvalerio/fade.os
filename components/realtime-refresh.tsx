"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * A operação (agenda, atendimento) precisa refletir mudanças de estado sem
 * recarregar a página — mas sem inventar um pipeline de dados novo: apenas
 * escuta mudanças nas tabelas relevantes e pede ao Next para revalidar o
 * server component atual. RLS já filtra o que cada usuário recebe; isto só
 * decide *quando* buscar de novo, nunca busca dados diretamente.
 */
export function RealtimeRefresh({ tables }: { tables: string[] }) {
  const router = useRouter();
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`realtime-refresh:${tables.join(",")}`);

    tables.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          if (timeout.current) clearTimeout(timeout.current);
          timeout.current = setTimeout(() => router.refresh(), 300);
        }
      );
    });

    channel.subscribe();

    return () => {
      if (timeout.current) clearTimeout(timeout.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(",")]);

  return null;
}
