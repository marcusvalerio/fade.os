"use client";

import { useEffect } from "react";
import { carregarObservabilidade, capturarNoNavegador } from "@/lib/observabilidade-navegador";

/**
 * Último recurso: erro no próprio layout raiz. Substitui o <html> inteiro,
 * então não conta com fontes nem tokens do app — estilo mínimo embutido.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    capturarNoNavegador(error, "global-error");
    void carregarObservabilidade();
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", background: "#fafafa", color: "#111" }}>
        <main style={{ maxWidth: 360, padding: 24, textAlign: "center" }}>
          <p style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Algo não saiu como esperado.</p>
          <p style={{ fontSize: 14, color: "#555", marginTop: 8 }}>Atualize a página. Se o problema continuar, tente de novo em instantes.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: 20, padding: "10px 16px", border: 0, borderRadius: 6, background: "#111", color: "#fff", fontSize: 14, cursor: "pointer" }}
          >
            Atualizar
          </button>
        </main>
      </body>
    </html>
  );
}
