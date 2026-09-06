"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[fade-os] erro na aplicação:", error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-sm text-center animate-rise-in">
        <p className="text-section-title text-foreground">Algo não saiu como esperado.</p>
        {/* error.message pode ser uma exceção técnica não tratada (ex.: "x.map is
            not a function") — nunca mostrar isso ao usuário. O detalhe real já foi
            para o console acima; aqui só uma mensagem compreensível. */}
        <p className="text-body-sm text-muted mt-1.5">Tente novamente em instantes. Se o problema continuar, atualize a página.</p>
        <Button onClick={reset} className="mt-6">
          Tentar de novo
        </Button>
      </div>
    </main>
  );
}
