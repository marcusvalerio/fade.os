/**
 * CORTEX MARK — o ícone de identidade do produto: um círculo cortado por
 * uma diagonal, em duas metades. Fechamento pré-piloto removeu o uso desta
 * forma como linguagem gráfica decorativa/atmosférica em qualquer tela —
 * o que sobra é só o ícone pequeno ao lado do wordmark (ver AppNav), o
 * mesmo papel que um favicon cumpre.
 */
import { cn } from "@/lib/cn";

type CortexMarkProps = {
  size?: number;
  angle?: number;
  gap?: number;
  toneA?: string;
  toneB?: string;
  variant?: "static" | "spin" | "resolve";
  className?: string;
};

function cutPoints(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const a1 = rad(90 - angleDeg);
  const a2 = rad(270 - angleDeg);
  return {
    p1: { x: cx + r * Math.cos(a1), y: cy - r * Math.sin(a1) },
    p2: { x: cx + r * Math.cos(a2), y: cy - r * Math.sin(a2) },
  };
}

export function CortexMark({
  size = 24,
  angle = 22,
  gap = 0,
  toneA = "currentColor",
  toneB = "var(--brand-blue)",
  variant = "static",
  className,
}: CortexMarkProps) {
  const cx = 16;
  const cy = 16;
  const r = 13;
  const { p1, p2 } = cutPoints(cx, cy, r, angle);
  const pathA = `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y} Z`;
  const pathB = `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 0 ${p2.x} ${p2.y} Z`;

  // Perpendicular ao corte, para a separação (gap) empurrar cada metade
  // para longe da outra em vez de para um lado arbitrário.
  const perpRad = ((angle + 90) * Math.PI) / 180;
  const dx = Math.cos(perpRad) * gap;
  const dy = -Math.sin(perpRad) * gap;

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      className={cn("cortex-mark", variant === "spin" && "cortex-mark-spin", className)}
    >
      <path
        d={pathA}
        fill={toneA}
        transform={`translate(${dx} ${dy})`}
        className={variant === "resolve" ? "cortex-mark-piece-a" : undefined}
        style={
          variant === "spin"
            ? { transformOrigin: "16px 16px", animation: "cortex-spin-a 2.4s linear infinite" }
            : undefined
        }
      />
      <path
        d={pathB}
        fill={toneB}
        transform={`translate(${-dx} ${-dy})`}
        className={variant === "resolve" ? "cortex-mark-piece-b" : undefined}
        style={
          variant === "spin"
            ? { transformOrigin: "16px 16px", animation: "cortex-spin-b 2.1s linear infinite" }
            : undefined
        }
      />
    </svg>
  );
}
