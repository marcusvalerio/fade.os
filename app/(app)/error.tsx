"use client";

import { useEffect } from "react";
import { capturarNoNavegador } from "@/lib/observabilidade-navegador";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[cortex-os] erro na aplicação:", error);
    // Com digest, o erro nasceu no servidor e o onRequestError já o registrou
    // (aqui só chega a mensagem genérica). Sem digest, é do navegador.
    if (!error.digest) capturarNoNavegador(error, "error-boundary");
  }, [error]);

  return (
    <div className="shell py-16">
      <div className="max-w-md mx-auto text-center animate-rise-in">
        <p className="text-section-title text-foreground">Algo não saiu como esperado.</p>
        {/* error.message pode ser uma exceção técnica não tratada (ex.: "x.map is
            not a function") — nunca mostrar isso ao usuário. O detalhe real já foi
            para o console e o Sentry acima; aqui só uma mensagem compreensível. */}
        <p className="text-body-sm text-muted mt-1.5">Tente novamente em instantes. Se o problema continuar, atualize a página.</p>
        <Button onClick={reset} className="mt-6">
          Tentar de novo
        </Button>
      </div>
    </div>
  );
}
