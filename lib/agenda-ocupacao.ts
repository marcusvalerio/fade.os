/**
 * Ocupação do dia de um profissional — quanto da jornada já está marcado.
 *
 * Aritmética pura sobre o que o banco já guarda (jornada, funcionamento da
 * unidade, intervalos e os horários marcados), sem nenhuma regra nova: a
 * janela de trabalho é a mesma que o motor de disponibilidade usa — a
 * interseção entre a jornada do profissional e o funcionamento da unidade,
 * menos os intervalos.
 */
export type Faixa = { inicio: string; fim: string }; // "HH:MM" ou "HH:MM:SS"

function minutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Minutos de trabalho possíveis no dia. Sem jornada ou sem funcionamento, zero. */
export function minutosDeJornada(jornada: Faixa | null, funcionamento: Faixa | null, intervalos: Faixa[] = []): number {
  if (!jornada || !funcionamento) return 0;
  const inicio = Math.max(minutos(jornada.inicio), minutos(funcionamento.inicio));
  const fim = Math.min(minutos(jornada.fim), minutos(funcionamento.fim));
  if (fim <= inicio) return 0;
  const pausas = intervalos.reduce((total, i) => {
    const a = Math.max(inicio, minutos(i.inicio));
    const b = Math.min(fim, minutos(i.fim));
    return total + Math.max(0, b - a);
  }, 0);
  return fim - inicio - pausas;
}

export type Ocupacao = { jornadaMin: number; ocupadoMin: number; livreMin: number; pct: number | null };

export function ocupacaoDoDia(jornadaMin: number, duracoesMarcadasMin: number[]): Ocupacao {
  const ocupadoMin = duracoesMarcadasMin.reduce((a, b) => a + Math.max(0, b), 0);
  return {
    jornadaMin,
    ocupadoMin,
    livreMin: Math.max(0, jornadaMin - ocupadoMin),
    pct: jornadaMin > 0 ? Math.min(100, Math.round((ocupadoMin / jornadaMin) * 100)) : null,
  };
}

/** "3h", "1h30", "45 min" — como se fala no balcão. */
export function formatarDuracao(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}
