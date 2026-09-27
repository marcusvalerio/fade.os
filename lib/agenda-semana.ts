/**
 * Faixas da grade semanal: horários que se sobrepõem no mesmo dia (de
 * profissionais diferentes) dividem a largura da coluna. Guloso por início:
 * cada bloco vai para a primeira faixa livre; o grupo de blocos que se
 * encadeiam por sobreposição usa o mesmo número de faixas.
 */
export type Bloco = { id: string; inicio: number; fim: number };

export function distribuirEmFaixas(blocos: Bloco[]): Map<string, { faixa: number; total: number }> {
  const ordenados = [...blocos].sort((a, b) => a.inicio - b.inicio || b.fim - a.fim);
  const resultado = new Map<string, { faixa: number; total: number }>();
  let grupo: { id: string; faixa: number }[] = [];
  let fimDoGrupo = -Infinity;
  let faixasFim: number[] = [];

  const fecharGrupo = () => {
    const total = Math.max(1, faixasFim.length);
    grupo.forEach((g) => resultado.set(g.id, { faixa: g.faixa, total }));
    grupo = [];
    faixasFim = [];
  };

  for (const b of ordenados) {
    if (b.inicio >= fimDoGrupo && grupo.length > 0) fecharGrupo();
    let faixa = faixasFim.findIndex((fim) => fim <= b.inicio);
    if (faixa === -1) {
      faixa = faixasFim.length;
      faixasFim.push(b.fim);
    } else {
      faixasFim[faixa] = b.fim;
    }
    grupo.push({ id: b.id, faixa });
    fimDoGrupo = Math.max(fimDoGrupo === -Infinity ? b.fim : fimDoGrupo, b.fim);
  }
  if (grupo.length > 0) fecharGrupo();
  return resultado;
}

/** Segunda-feira da semana de uma data "YYYY-MM-DD" (a agenda começa na segunda). */
export function segundaDaSemana(data: string): string {
  const [a, m, d] = data.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  const dow = dt.getUTCDay(); // 0 = domingo
  dt.setUTCDate(dt.getUTCDate() - ((dow + 6) % 7));
  return dt.toISOString().slice(0, 10);
}
