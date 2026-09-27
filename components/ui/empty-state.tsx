import type { ReactNode } from "react";
import { Vazio } from "@/components/ui/estado";

/**
 * Nome antigo do estado vazio, mantido para as telas que ainda o usam. Era
 * uma cópia visual exata de <Vazio /> (components/ui/estado.tsx) — agora é
 * ele mesmo, para que um ajuste no estado vazio chegue a todas as telas.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return <Vazio titulo={title} descricao={description} acao={action} />;
}
