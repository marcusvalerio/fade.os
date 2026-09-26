import { STATUS_CLIENTE } from "@/lib/crm";
import { cn } from "@/lib/cn";
import type { ClientStatus } from "@/lib/types";

const SINAL: Record<ClientStatus, string> = {
  ativo: "bg-success",
  atencao: "bg-warning",
  recuperacao: "bg-danger",
  inativo: "border border-border-strong",
};

const TINTA: Record<ClientStatus, string> = {
  ativo: "text-success-ink",
  atencao: "text-warning-ink",
  recuperacao: "text-danger-ink",
  inativo: "text-muted",
};

/**
 * A situação do cliente no ritmo dele (lib/crm.ts) como o sinal do CORTEX —
 * quadrado + palavra — em vez de um badge. Numa lista, "ativo" é o normal e
 * não precisa ser dito em toda linha: só o que pede ação aparece
 * (`ocultarAtivo`). A palavra é sempre visível; a cor nunca é o único sinal.
 */
export function SituacaoCliente({
  status,
  ocultarAtivo = false,
  className,
}: {
  status: ClientStatus;
  ocultarAtivo?: boolean;
  className?: string;
}) {
  if (ocultarAtivo && status === "ativo") return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-caption font-medium", TINTA[status], className)}>
      <span aria-hidden="true" className={cn("size-1.5 shrink-0", SINAL[status])} />
      {STATUS_CLIENTE[status].rotulo}
    </span>
  );
}
