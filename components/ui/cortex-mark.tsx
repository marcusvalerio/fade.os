/**
 * CORTEX MARK — o símbolo da marca quando ela precisa caber em pouco espaço:
 * o quadrado azul, sozinho.
 *
 * É o mesmo quadrado que separa CORTEX de OS no wordmark (ver
 * components/ui/wordmark.tsx), só que sem as palavras em volta — a sidebar
 * recolhida, o favicon (app/icon.svg), o ícone do app. Não é uma forma nova:
 * quando a marca encolhe, sobra o quadrado.
 *
 * O círculo cortado que existia aqui foi removido por decisão de marca e não
 * volta em nenhuma variação — nem como ícone, nem como spinner, nem como
 * atmosfera.
 */
import { cn } from "@/lib/cn";

export function CortexMark({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("marca-simbolo", className)}
      style={{ width: size, height: size }}
    />
  );
}
