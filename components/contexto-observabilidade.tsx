"use client";

import { useEffect } from "react";
import type { ContextoDeUso } from "@/lib/observabilidade";
import { contextoNoNavegador } from "@/lib/observabilidade-navegador";

/**
 * Marca os erros do navegador com quem está usando — só ids e papel. O
 * servidor já marca os dele no layout; este componente faz o mesmo do lado
 * do cliente e não renderiza nada.
 */
export function ContextoObservabilidade(props: ContextoDeUso) {
  const { usuarioId, empresaId, papel, area } = props;
  useEffect(() => {
    contextoNoNavegador({ usuarioId, empresaId, papel, area });
  }, [usuarioId, empresaId, papel, area]);
  return null;
}
