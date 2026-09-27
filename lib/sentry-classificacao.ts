/**
 * Classificação dos problemas lidos do Sentry — pura, testada. Nada aqui
 * chama a API; o que é "novo" ou "recorrente" é decidido pelas datas e
 * contagens que o próprio Sentry devolve.
 */

export type ProblemaDoSentry = {
  id: string;
  codigo: string; // ex.: CORTEX-OS-12
  titulo: string;
  rota: string | null; // culprit: rota ou função onde estourou
  nivel: "fatal" | "error" | "warning" | "info" | "debug";
  status: string; // unresolved | resolved | ignored
  ocorrencias: number;
  pessoas: number;
  primeiraVez: string;
  ultimaVez: string;
  link: string;
  naoTratado: boolean;
};

export type ProblemaClassificado = ProblemaDoSentry & { novo: boolean; recorrente: boolean };

const DIA = 24 * 3600 * 1000;

export function classificar(p: ProblemaDoSentry, agora = Date.now()): ProblemaClassificado {
  const primeira = new Date(p.primeiraVez).getTime();
  const ultima = new Date(p.ultimaVez).getTime();
  const novo = agora - primeira < DIA;
  // Recorrente: voltou a acontecer em dias diferentes, ou muitas vezes.
  const recorrente = !novo && (ultima - primeira > DIA || p.ocorrencias >= 5);
  return { ...p, novo, recorrente };
}

/** Converte a resposta da API de issues do Sentry no formato acima. */
export function lerProblema(bruto: Record<string, unknown>): ProblemaDoSentry | null {
  const id = typeof bruto.id === "string" ? bruto.id : null;
  if (!id) return null;
  const nivel = String(bruto.level ?? "error");
  return {
    id,
    codigo: String(bruto.shortId ?? id),
    titulo: String(bruto.title ?? "Erro sem título"),
    rota: typeof bruto.culprit === "string" && bruto.culprit ? bruto.culprit : null,
    nivel: (["fatal", "error", "warning", "info", "debug"].includes(nivel) ? nivel : "error") as ProblemaDoSentry["nivel"],
    status: String(bruto.status ?? "unresolved"),
    ocorrencias: Number(bruto.count ?? 0) || 0,
    pessoas: Number(bruto.userCount ?? 0) || 0,
    primeiraVez: String(bruto.firstSeen ?? ""),
    ultimaVez: String(bruto.lastSeen ?? ""),
    link: String(bruto.permalink ?? ""),
    naoTratado: bruto.isUnhandled === true,
  };
}

export type ResumoDeErros = { abertos: number; novos24h: number; recorrentes: number; ocorrencias: number };

export function resumir(lista: ProblemaClassificado[]): ResumoDeErros {
  const abertos = lista.filter((p) => p.status === "unresolved");
  return {
    abertos: abertos.length,
    novos24h: abertos.filter((p) => p.novo).length,
    recorrentes: abertos.filter((p) => p.recorrente).length,
    ocorrencias: abertos.reduce((s, p) => s + p.ocorrencias, 0),
  };
}
