"use client";

import { useState } from "react";

/**
 * "Sair" que também desliga o push deste navegador: depois de sair, os
 * avisos daquela conta não aparecem mais aqui (computador compartilhado,
 * celular emprestado). Se desligar falhar, a saída acontece do mesmo jeito.
 */
export function FormularioSair({
  acao,
  className,
  children,
}: {
  acao: () => Promise<void>;
  className?: string;
  children: React.ReactNode;
}) {
  const [saindo, setSaindo] = useState(false);
  return (
    <form
      className={className}
      onSubmit={async (e) => {
        e.preventDefault();
        if (saindo) return;
        setSaindo(true);
        try {
          const p = await import("@/lib/notificacoes/push-navegador");
          await Promise.race([p.esquecerAparelhoAoSair(), new Promise((r) => setTimeout(r, 2500))]);
        } catch {
          /* sai mesmo assim */
        }
        await acao();
      }}
      aria-busy={saindo}
    >
      {children}
    </form>
  );
}
