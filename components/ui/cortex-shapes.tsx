/**
 * O CORTE — vocabulário (R23.2).
 *
 * O CortexMark (círculo cortado por uma diagonal) era tratado como a
 * linguagem gráfica inteira. Na referência de marca ele é só UMA peça de um
 * alfabeto — círculo, semicírculo, triângulo, módulo — que se combinam livre
 * mas deliberadamente, nunca como confete. Estas são as peças soltas; quem
 * compõe decide a combinação.
 */
import { cn } from "@/lib/cn";

type PecaProps = {
  size?: number;
  fill?: string;
  rotate?: number;
  className?: string;
};

export function CortexCirculo({ size = 24, fill = "currentColor", className }: PecaProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" className={className}>
      <circle cx="16" cy="16" r="13" fill={fill} />
    </svg>
  );
}

export function CortexSemicirculo({ size = 24, fill = "currentColor", rotate = 0, className }: PecaProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      className={cn(className)}
      style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}
    >
      <path d="M 3 16 A 13 13 0 0 1 29 16 Z" fill={fill} />
    </svg>
  );
}

export function CortexTriangulo({ size = 24, fill = "currentColor", rotate = 0, className }: PecaProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      className={cn(className)}
      style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}
    >
      <path d="M 16 3 L 29 27 L 3 27 Z" fill={fill} />
    </svg>
  );
}

/**
 * Um aglomerado de 3 peças — a mesma lógica da referência ("uma linguagem,
 * infinitas aplicações"): formas discretas, sobrepostas com intenção, nunca
 * espalhadas ao acaso. Usado como textura editorial atrás de superfícies
 * Glass ou em momentos de conclusão — nunca sobre conteúdo operacional.
 */
export function CortexAglomerado({
  toneA = "var(--brand-blue)",
  toneB = "var(--brand-yellow)",
  toneC = "var(--neutral-ink)",
  className,
}: {
  toneA?: string;
  toneB?: string;
  toneC?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)} aria-hidden="true">
      <CortexCirculo size={220} fill={toneB} className="absolute -left-10 -top-16 opacity-90" />
      <CortexTriangulo size={160} fill={toneC} rotate={18} className="absolute left-24 top-6 opacity-80" />
      <CortexSemicirculo size={180} fill={toneA} rotate={-24} className="absolute -right-6 top-20 opacity-90" />
    </div>
  );
}
