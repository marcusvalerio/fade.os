/**
 * Regras do Início — contas pequenas, puras e testadas, sobre números que o
 * banco já devolveu. Nenhum número é estimado sem dizer que é estimativa.
 */

export type EstadoDoDia = {
  titulo: string;
  tom: "normal" | "atencao" | "calmo";
};

export type NumerosDeHoje = {
  total: number;
  restantes: number;
  emAtendimento: number;
  aguardando: number;
  concluidos: number;
  atrasados: number;
  esperandoMuito: number;
};

/** O título do Início: o estado da operação em duas ou três palavras. */
export function estadoDoDia(d: NumerosDeHoje): EstadoDoDia {
  if (d.esperandoMuito > 0) return { titulo: "Tem cliente esperando.", tom: "atencao" };
  if (d.atrasados > 0) return { titulo: "Horários atrasando.", tom: "atencao" };
  if (d.emAtendimento > 0 || d.aguardando > 0) return { titulo: "Operação em andamento.", tom: "normal" };
  if (d.total === 0) return { titulo: "Agenda livre hoje.", tom: "calmo" };
  if (d.restantes === 0) return { titulo: "Dia encerrado.", tom: "calmo" };
  return { titulo: "Dia pela frente.", tom: "normal" };
}

export type Variacao =
  | { tipo: "sem-base" }
  | { tipo: "igual" }
  | { tipo: "subiu" | "caiu"; pct: number };

/** Atual contra o período anterior de mesmo tamanho. Sem base, não inventa %. */
export function variacao(atual: number, anterior: number | null | undefined): Variacao {
  if (anterior === null || anterior === undefined || anterior === 0) return { tipo: "sem-base" };
  const pct = Math.round(((atual - anterior) / Math.abs(anterior)) * 100);
  if (pct === 0) return { tipo: "igual" };
  return { tipo: pct > 0 ? "subiu" : "caiu", pct: Math.abs(pct) };
}

export function textoDaVariacao(v: Variacao): string {
  if (v.tipo === "sem-base") return "sem período anterior para comparar";
  if (v.tipo === "igual") return "igual ao período anterior";
  return `${v.tipo === "subiu" ? "↑" : "↓"} ${v.pct}% vs período anterior`;
}

export type RitmoDaMeta = {
  pct: number;
  /** Projeção linear do mês no ritmo atual — sempre rotulada como tal. */
  projecao: number;
  falta: number;
};

/**
 * Meta do mês: quanto já foi (% da meta), quanto falta e onde o mês termina
 * se o ritmo dos dias passados continuar. `dia` é o dia do mês (1–31).
 */
export function ritmoDaMeta(faturadoNoMes: number, meta: number, dia: number, diasNoMes: number): RitmoDaMeta | null {
  if (!(meta > 0) || dia < 1 || diasNoMes < dia) return null;
  return {
    pct: Math.round((faturadoNoMes / meta) * 100),
    projecao: Math.round((faturadoNoMes / dia) * diasNoMes * 100) / 100,
    falta: Math.max(0, Math.round((meta - faturadoNoMes) * 100) / 100),
  };
}

/** Parte de um todo, arredondada — null quando não há todo. */
export function proporcao(parte: number, todo: number): number | null {
  if (!(todo > 0)) return null;
  return Math.min(100, Math.max(0, Math.round((parte / todo) * 100)));
}

/** Repor quanto: o que falta para voltar ao mínimo (ou "zerado" sem mínimo). */
export function reposicao(atual: number, minimo: number): { tipo: "zerado" } | { tipo: "repor"; quantidade: number } {
  if (minimo <= 0) return { tipo: "zerado" };
  return { tipo: "repor", quantidade: Math.max(0, Math.ceil(minimo - atual)) };
}
