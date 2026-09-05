"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
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
    <div className="shell py-16">
      <div className="max-w-md mx-auto text-center animate-rise-in">
        <p className="text-section-title text-foreground">Algo não saiu como esperado.</p>
        <p className="text-body-sm text-muted mt-1.5">{error.message || "Tente novamente em instantes."}</p>
        <Button onClick={reset} className="mt-6">
          Tentar de novo
        </Button>
      </div>
    </div>
  );
}
