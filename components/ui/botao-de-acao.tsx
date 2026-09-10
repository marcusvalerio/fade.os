"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * O botão que conta a própria história.
 *
 *   FINALIZAR VENDA  →  FINALIZANDO…  →  VENDA FINALIZADA ✓
 *
 * A alternativa que existia era: botão + toast + modal + troca de página, com
 * a confirmação aparecendo longe do dedo que apertou. Aqui a consequência
 * nasce onde a ação aconteceu, que é onde a pessoa está olhando.
 *
 * O toast continua existindo — mas para o que sobrevive à navegação (um erro
 * que precisa ser lido na próxima tela) e não para confirmar o óbvio.
 *
 * `useFormStatus` só enxerga o form em que o botão está, então este
 * componente precisa viver DENTRO do <form>. É essa a razão de ele ser
 * separado do Button comum.
 */
export function BotaoDeAcao({
  children,
  rotuloPendente,
  rotuloConcluido,
  variant = "primary",
  size = "md",
  className,
  disabled,
  ...props
}: {
  children: React.ReactNode;
  /** "Finalizando…" — o gerúndio importa: diz que está acontecendo agora. */
  rotuloPendente?: string;
  /** "Venda finalizada" — o particípio fecha o ciclo. */
  rotuloConcluido?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  const { pending } = useFormStatus();
  const [concluido, setConcluido] = useState(false);
  const estavaPendente = useRef(false);

  useEffect(() => {
    if (pending) {
      estavaPendente.current = true;
      setConcluido(false);
      return;
    }

    // Só celebra o que de fato passou por "pendente". Sem isso, o botão
    // nasceria dizendo "concluído" na primeira renderização.
    if (!estavaPendente.current || !rotuloConcluido) return;
    estavaPendente.current = false;
    setConcluido(true);

    // A confirmação é um instante, não um estado: em ações que navegam, a
    // tela troca antes disso; nas que ficam, o botão volta a ser botão.
    const id = window.setTimeout(() => setConcluido(false), 2200);
    return () => window.clearTimeout(id);
  }, [pending, rotuloConcluido]);

  const rotulo = pending ? rotuloPendente ?? children : concluido ? rotuloConcluido : children;

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      pending={pending}
      disabled={disabled || pending}
      // aria-live no próprio botão: quem usa leitor de tela ouve "Finalizando"
      // e depois "Venda finalizada" sem precisar procurar um toast.
      aria-live="polite"
      className={cn(
        concluido && "bg-success text-success-foreground animate-confirmar",
        className
      )}
      {...props}
    >
      {concluido && (
        <span aria-hidden="true" className="text-[0.9em] leading-none">
          ✓
        </span>
      )}
      {rotulo}
    </Button>
  );
}
