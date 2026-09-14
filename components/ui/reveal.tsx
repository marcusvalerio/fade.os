"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Fechamento pré-piloto — entrada por ORIGEM ao rolar a página: a seção só
 * se assenta quando cruza a viewport, uma vez, nunca em loop. Atraso em
 * cascata (via `delayMs`) é o que faz "headline entra primeiro, produto
 * responde depois" em vez de tudo aparecer junto. Sem IntersectionObserver
 * disponível (SSR) ou com prefers-reduced-motion, renderiza já assentado —
 * nunca esconde conteúdo esperando JS.
 */
export function Reveal({
  children,
  delayMs = 0,
  className,
}: {
  children: React.ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduzido) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(!visible && "opacity-0", className)}
      style={visible ? { animation: `entra-origem 640ms var(--ease-emphasized) both`, animationDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
