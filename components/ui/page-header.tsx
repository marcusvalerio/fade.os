import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  // O botão de ação usa `whitespace-nowrap` e a linha não quebrava: em 390px,
  // "Novo atendimento (walk-in)" e "Novo profissional" saíam 35–42px pela
  // direita e o documento inteiro ganhava rolagem horizontal. Com quebra e uma
  // base mínima para o título, a ação desce para a própria linha em vez de
  // empurrar a página.
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 mb-6 animate-rise-in">
      <div className="min-w-0 flex-1 basis-64">
        {/* Supreme (font-heading) — a voz editorial do produto entra aqui,
            no título de quase toda tela, sem competir com a Panchang da
            marca (R22). */}
        <h1 className="text-page-title font-heading text-foreground">{title}</h1>
        {description && <p className="text-body-sm text-muted mt-1">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
