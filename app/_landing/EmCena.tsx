"use client";

import { useEffect, useRef } from "react";

/**
 * Liga `data-cena` quando o elemento entra na tela — uma vez. As
 * demonstrações curtas da landing (o valor contado sendo digitado no
 * fechamento de caixa, a marca se montando no fim da página) começam daí,
 * em CSS. Sem JS, ou com prefers-reduced-motion, o CSS mostra direto o
 * estado final (o atributo não é necessário para ler o conteúdo).
 */
export function EmCena({ children, className, limite = 0.5 }: { children: React.ReactNode; className?: string; limite?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.dataset.cena = "fim";
      return;
    }
    el.dataset.cena = "espera";
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        el.dataset.cena = "on";
        io.disconnect();
      },
      { threshold: limite }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [limite]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
