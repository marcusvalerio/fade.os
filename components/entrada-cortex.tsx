"use client";

import { useEffect, useState } from "react";
import { desmarcarEntrada } from "@/lib/entrada";

/**
 * Login → CORTEX ■ OS → produto, em 900ms.
 *
 *   0–170ms    o quadrado azul aparece grande, no centro da tela
 *   170–560ms  ele se assenta no tamanho do wordmark; CORTEX se revela para a
 *              esquerda a partir dele e OS para a direita
 *   560–640ms  a marca inteira, parada — é o "entrei"
 *   640–900ms  a tela se abre e o produto já está ali embaixo
 *
 * Tudo em CSS (globals.css, .entrada-*): só transform, opacity e clip-path,
 * nada que force layout. O HTML chega do servidor já com a sequência, então
 * ela começa no primeiro paint. O quadrado fica no centro exato da tela — a
 * grade põe CORTEX à esquerda e OS à direita dele — porque é o quadrado que
 * conduz a sequência, não a palavra.
 *
 * Quem pediu menos movimento não vê nada disto (display: none): entra direto
 * no produto. A camada nunca recebe clique, então ela não bloqueia nem os
 * 900ms em que existe.
 */
export function EntradaCortex() {
  const [presente, setPresente] = useState(true);

  useEffect(() => {
    desmarcarEntrada();
    const id = window.setTimeout(() => setPresente(false), 1000);
    return () => window.clearTimeout(id);
  }, []);

  if (!presente) return null;

  return (
    <div className="entrada-cortex" aria-hidden="true">
      <div className="entrada-lockup font-brand">
        <span className="entrada-nome">CORTEX</span>
        <span className="entrada-quadrado" />
        <span className="entrada-sufixo">OS</span>
      </div>
    </div>
  );
}
