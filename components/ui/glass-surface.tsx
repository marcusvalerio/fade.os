import type { ElementType, ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

/**
 * GlassSurface — a única implementação de vidro do produto (R23).
 *
 * Antes de R23, "glass" era uma classe CSS solta (`.material-glass`)
 * reaplicada onde alguém lembrava. Esta é a primitive: toda superfície que
 * flutua ACIMA do conteúdo (nunca o conteúdo em si — ver Material System)
 * passa por aqui.
 *
 * `tone="shell"` usa sempre o tingimento navy do shell (--shell-glass-*),
 * invariante por tema — para navegação e o que vive dentro dela (o menu do
 * seletor de empresa, por exemplo). `tone="content"` usa a superfície
 * elevada do tema atual com a mesma receita de translucidez — para popovers
 * e toolbars que aparecem sobre uma tela de conteúdo, não sobre o shell.
 * `tone="decision"` (R23.2) tinge de Kahu Blue, invariante por tema: um
 * painel de decisão carrega identidade, não fica neutro.
 */
type GlassSurfaceProps<T extends ElementType> = {
  as?: T;
  tone?: "shell" | "content" | "decision";
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className">;

const TONE_CLASS = {
  shell: "glass-surface-shell",
  content: "glass-surface-content",
  decision: "glass-surface-decision",
} as const;

export function GlassSurface<T extends ElementType = "div">({
  as,
  tone = "content",
  className,
  ...props
}: GlassSurfaceProps<T>) {
  const Component = as || "div";
  return <Component className={cn(TONE_CLASS[tone], className)} {...props} />;
}
