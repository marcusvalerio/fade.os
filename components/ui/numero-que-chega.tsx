"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Um número que chega: conta de zero até o valor uma vez, quando aparece —
 * diz "isto foi medido agora", não decora. 560ms (o tempo de "momento"),
 * curva que assenta devagar. Com movimento reduzido (ou sem JS) o valor já
 * nasce pronto: o HTML do servidor traz o número final.
 */
export function NumeroQueChega({
  valor,
  formato = "numero",
  className,
}: {
  valor: number;
  formato?: "numero" | "moeda" | "porcento";
  className?: string;
}) {
  const [exibido, setExibido] = useState(valor);
  const iniciou = useRef(false);

  useEffect(() => {
    if (iniciou.current) {
      setExibido(valor);
      return;
    }
    iniciou.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || valor === 0) return;
    const inicio = performance.now();
    const duracao = 560;
    let quadro = 0;
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / duracao);
      const suave = 1 - Math.pow(1 - t, 4);
      setExibido(valor * suave);
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    setExibido(0);
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor]);

  const texto =
    formato === "moeda"
      ? exibido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : formato === "porcento"
        ? `${Math.round(exibido)}%`
        : Math.round(exibido).toLocaleString("pt-BR");

  return (
    <span className={className}>
      {/* Leitor de tela lê o valor final, nunca a contagem. */}
      <span aria-hidden="true">{texto}</span>
      <span className="sr-only">
        {formato === "moeda"
          ? valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
          : formato === "porcento"
            ? `${Math.round(valor)}%`
            : valor.toLocaleString("pt-BR")}
      </span>
    </span>
  );
}
