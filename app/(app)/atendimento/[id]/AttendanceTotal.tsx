"use client";

import { formatCurrency } from "@/lib/format";

/**
 * O total do atendimento — a resposta a "quanto está dando isso até agora".
 *
 * Ganha o mesmo peso tipográfico de um KPI do Início (text-metric): é o
 * número mais importante da tela, e um valor do tamanho de um rótulo de
 * seção não comunicava isso. A troca de valor usa `key={total}` para forçar
 * a re-montagem do nó e reaproveitar `animate-rise-in` — uma resposta breve
 * e na mesma família de movimento do resto do produto, não um efeito à
 * parte.
 */
export function AttendanceTotal({ total }: { total: number }) {
  return (
    <div key={total} className="flex justify-between items-baseline animate-rise-in">
      <span className="text-label uppercase text-muted">Total</span>
      <span className="text-metric text-foreground tabular-nums">{formatCurrency(total)}</span>
    </div>
  );
}
