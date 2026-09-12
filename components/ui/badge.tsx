import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

// -ink, não a cor de identidade solta (R19): amarelo/verde sobre um fundo
// quase branco no tema claro reproduzem exatamente o problema que o
// próprio globals.css documenta — a mesma cor que passa como preenchimento
// não passa como texto. bg-X/15 continua a mesma tinta de fundo; só o
// texto por cima muda para a variante já calibrada por tema.
const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted",
  success: "bg-success/15 text-success-ink",
  warning: "bg-warning/15 text-warning-ink",
  danger: "bg-danger/15 text-danger-ink",
  info: "bg-info/15 text-info",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-caption font-medium whitespace-nowrap",
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    />
  );
}
