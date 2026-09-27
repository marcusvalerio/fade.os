/**
 * Tendência semanal a partir da série diária do banco (get_dashboard_series,
 * já no fuso da barbearia). Doze semanas, segunda a domingo; a última é a
 * semana corrente (incompleta — a tela diz isso). Nada é estimado: semana
 * sem atendimento tem ticket null, não zero.
 */
export type PontoDiario = { dia: string; faturamento: number; atendimentos: number; clientes_novos: number };

export type Semana = {
  inicio: string; // segunda-feira, YYYY-MM-DD
  faturamento: number;
  atendimentos: number;
  clientesNovos: number;
  ticket: number | null;
};

function segunda(data: string): string {
  const [a, m, d] = data.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
}

function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

/** Primeiro dia (segunda) da janela de N semanas que termina na semana de `hoje`. */
export function inicioDaJanela(hoje: string, semanas = 12): string {
  return somarDias(segunda(hoje), -7 * (semanas - 1));
}

export function porSemana(serie: PontoDiario[], hoje: string, semanas = 12): Semana[] {
  const primeira = inicioDaJanela(hoje, semanas);
  const baldes: Semana[] = Array.from({ length: semanas }, (_, i) => ({
    inicio: somarDias(primeira, i * 7),
    faturamento: 0,
    atendimentos: 0,
    clientesNovos: 0,
    ticket: null,
  }));
  const indice = new Map(baldes.map((b, i) => [b.inicio, i]));
  for (const p of serie) {
    const i = indice.get(segunda(p.dia));
    if (i === undefined) continue;
    baldes[i].faturamento += Number(p.faturamento) || 0;
    baldes[i].atendimentos += Number(p.atendimentos) || 0;
    baldes[i].clientesNovos += Number(p.clientes_novos) || 0;
  }
  for (const b of baldes) {
    b.faturamento = Math.round(b.faturamento * 100) / 100;
    b.ticket = b.atendimentos > 0 ? Math.round((b.faturamento / b.atendimentos) * 100) / 100 : null;
  }
  return baldes;
}

/** Há movimento suficiente para uma tendência dizer alguma coisa? (2+ semanas com dado) */
export function temTendencia(valores: (number | null)[]): boolean {
  return valores.filter((v) => v !== null && v > 0).length >= 2;
}
