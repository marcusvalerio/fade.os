"use client";

import { createContext, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Coordena o fechamento do atendimento com as mutações de item (adicionar
 * serviço/produto, editar item) que vivem em componentes irmãos.
 *
 * `router.refresh()` sozinho não avisa ninguém quando termina — cada forma
 * chamava-o isoladamente, e nada impedia "Fechar e receber" de abrir o
 * pagamento com o total de uma renderização anterior enquanto o refresh
 * ainda estava a caminho. Envolver o refresh numa transição dá exatamente
 * esse sinal (`isPending`), sem inventar um segundo lugar onde os itens são
 * guardados: os dados continuam vindo só do servidor.
 */
type AttendanceSyncContextValue = {
  /** true do clique em "Adicionar"/"Salvar" até o total já refletir o item. */
  refreshing: boolean;
  refreshItems: () => void;
};

const AttendanceSyncContext = createContext<AttendanceSyncContextValue | null>(null);

export function AttendanceSyncProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  function refreshItems() {
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <AttendanceSyncContext.Provider value={{ refreshing, refreshItems }}>
      {children}
    </AttendanceSyncContext.Provider>
  );
}

export function useAttendanceSync(): AttendanceSyncContextValue {
  const ctx = useContext(AttendanceSyncContext);
  if (!ctx) {
    throw new Error("useAttendanceSync precisa de <AttendanceSyncProvider> por perto.");
  }
  return ctx;
}
