/**
 * Mínimo operacional de uma barbearia.
 */
export type ReadinessKey =
  | "unidade"
  | "servico"
  | "profissional"
  | "profissional_servico"
  | "pagamento"
  | "funcionamento"
  | "jornada";

export type ReadinessItem = { key: ReadinessKey; ok: boolean; label: string };
export type Readiness = { ready: boolean; items: ReadinessItem[]; missing: ReadinessItem[] };

export const READINESS_LABEL: Record<ReadinessKey, string> = {
  unidade: "Uma unidade cadastrada",
  servico: "Pelo menos um serviço",
  profissional: "Pelo menos um profissional",
  profissional_servico: "Pelo menos um profissional habilitado em um serviço",
  pagamento: "Pelo menos uma forma de pagamento ativa",
  funcionamento: "Horário de funcionamento da unidade",
  jornada: "Jornada de pelo menos um profissional",
};

export function buildReadiness(counts: Record<ReadinessKey, number>): Readiness {
  const items = (Object.keys(READINESS_LABEL) as ReadinessKey[]).map((key) => ({
    key,
    ok: counts[key] > 0,
    label: READINESS_LABEL[key],
  }));
  const missing = items.filter((item) => !item.ok);
  return { ready: missing.length === 0, items, missing };
}
