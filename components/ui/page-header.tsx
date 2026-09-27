import type { ReactNode } from "react";

/**
 * Cabeçalho de tela — o mesmo vocabulário da landing: eyebrow com o quadrado
 * da marca (onde você está), título em Familjen apertado (o que é esta
 * tela) e um subtítulo curto em Supreme (para que ela serve). A ação
 * principal fica ao lado; em telas estreitas desce para a própria linha.
 */
export function PageHeader({
  title,
  description,
  action,
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 mb-8 animate-rise-in">
      <div className="min-w-0 flex-1 basis-64">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="text-page-title text-foreground text-balance">{title}</h1>
        {description && (
          <p className="font-subtitle text-subtitle text-muted mt-2.5 max-w-[60ch] text-pretty">{description}</p>
        )}
      </div>
      {action && <div className="max-w-full flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
