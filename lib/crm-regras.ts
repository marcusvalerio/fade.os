import type { ClientStatus } from "@/lib/types";

/*
 * As regras do ritmo do cliente — só contas, nenhuma consulta. Separadas de
 * lib/crm.ts (que lê o banco) para poderem ser usadas em qualquer lugar,
 * inclusive em componente de cliente, com exatamente a mesma régua.
 */

export type ClientBehavior = {
  clientId: string;
  visitCount: number;
  lastVisit: string | null;
  avgGapDays: number | null;
  daysSinceVisit: number | null;
  status: ClientStatus;
};

/**
 * Estado comportamental por CLIENTE, nunca por regra genérica tipo "duas
 * mensagens ignoradas" (seção 11 é explícita sobre isso). Compara o
 * intervalo real desse cliente com ele mesmo — um cliente que sempre volta
 * a cada 60 dias não fica "em recuperação" aos 35 dias só porque outro
 * cliente costuma voltar a cada 20.
 *
 * Sem histórico suficiente (0 ou 1 visita), o cliente é tratado como
 * "ativo" por padrão — não há dado pra classificar como qualquer outra
 * coisa, e "recém-chegado" não é um problema comportamental.
 */
function classify(avgGapDays: number | null, daysSinceVisit: number | null): ClientStatus {
  if (avgGapDays === null || daysSinceVisit === null) return "ativo";
  const ratio = daysSinceVisit / avgGapDays;
  if (ratio <= 1.5) return "ativo";
  if (ratio <= 2.5) return "atencao";
  if (ratio <= 4) return "recuperacao";
  return "inativo";
}

const DIA_MS = 1000 * 60 * 60 * 24;

/**
 * O comportamento de UM cliente a partir das datas das visitas concluídas
 * (em ms, em ordem crescente). É a mesma conta da lista de Clientes, exposta
 * para a ficha do cliente usar exatamente a mesma régua — não uma segunda
 * versão aproximada.
 */
export function comportamentoDoCliente(clientId: string, visits: number[], now: number): ClientBehavior {
  const lastVisitMs = visits[visits.length - 1];
  const daysSinceVisit = Math.round((now - lastVisitMs) / DIA_MS);

  let avgGapDays: number | null = null;
  if (visits.length >= 2) {
    const gaps = visits.slice(1).map((t, i) => (t - visits[i]) / DIA_MS);
    avgGapDays = Math.round(gaps.reduce((sum, g) => sum + g, 0) / gaps.length) || 1;
  }

  return {
    clientId,
    visitCount: visits.length,
    lastVisit: new Date(lastVisitMs).toISOString(),
    avgGapDays,
    daysSinceVisit,
    status: classify(avgGapDays, daysSinceVisit),
  };
}

/** Como cada situação aparece na tela — um lugar só para lista e ficha. */
export const STATUS_CLIENTE: Record<ClientStatus, { rotulo: string; tom: "success" | "warning" | "danger" | "neutral" }> = {
  ativo: { rotulo: "ativo", tom: "success" },
  atencao: { rotulo: "atenção", tom: "warning" },
  recuperacao: { rotulo: "recuperação", tom: "danger" },
  inativo: { rotulo: "inativo", tom: "neutral" },
};

/**
 * A mensagem que a equipe envia (ela, pelo WhatsApp — o CORTEX só prepara o
 * texto) para quem passou do próprio ritmo. Fala do intervalo real do
 * cliente, sem desconto nem promessa que a barbearia não fez.
 */
export function mensagemDeRetorno(nomeCliente: string, nomeBarbearia: string, diasSemVir: number | null): string {
  const primeiro = nomeCliente.trim().split(/\s+/)[0] || "tudo bem";
  const tempo = diasSemVir && diasSemVir > 0 ? `faz ${diasSemVir} dias da sua última visita` : "faz um tempo da sua última visita";
  return `Oi, ${primeiro}! Aqui é da ${nomeBarbearia}. ${tempo[0].toUpperCase()}${tempo.slice(1)} — quer que a gente reserve um horário pra você?`;
}

/** Quem está mais longe do próprio ritmo vem primeiro. */
export function urgenciaDeRetorno(c: Pick<ClientBehavior, "avgGapDays" | "daysSinceVisit">): number {
  if (!c.avgGapDays || c.daysSinceVisit === null) return 0;
  return c.daysSinceVisit / c.avgGapDays;
}
