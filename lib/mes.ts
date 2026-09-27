import { businessInstant } from "./time.ts";

/** "2026-09" → limites do mês no fuso da barbearia, e os vizinhos. */
export function limitesDoMes(mes: string): { de: Date; ate: Date; anterior: string; seguinte: string } {
  const [a, m] = mes.split("-").map(Number);
  const seguinte = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
  const anterior = m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
  return { de: businessInstant(`${mes}-01T00:00`), ate: businessInstant(`${seguinte}-01T00:00`), anterior, seguinte };
}

export function mesValido(mes: string | undefined, hoje: string): string {
  return mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) && mes <= hoje.slice(0, 7) ? mes : hoje.slice(0, 7);
}

export function rotuloDoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const nome = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, 1)));
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${a}`;
}
