/**
 * Mínimo operacional de uma barbearia.
 *
 * O teste operacional reproduziu o wizard terminando com "Tudo pronto" numa
 * empresa com 0 formas de pagamento, 0 horários de funcionamento e 0 jornadas
 * de profissional. A tela dizia que estava tudo certo e a barbearia não
 * conseguia nem agendar (o motor de disponibilidade exige funcionamento da
 * unidade E jornada do profissional) nem receber (fechar venda exige forma de
 * pagamento ativa).
 *
 * Esta lista é a definição única de "operável", usada tanto pelo wizard,
 * para mostrar o que falta, quanto pelo servidor, para recusar a conclusão.
 * O texto de cada item é o que aparece para o dono, então descreve a ação,
 * não a tabela.
 */
export type ReadinessKey =
  | "unidade"
  | "servico"
  | "profissional"
  | "profissional_servico"
  | "pagamento"
  | "funcionamento"
  | "jornada";

export type ReadinessItem = {
  key: ReadinessKey;
  ok: boolean;
  /** O que falta, na voz de quem precisa resolver. */
  label: string;
};

export type Readiness = {
  ready: boolean;
  items: ReadinessItem[];
  /** Só o que está faltando, na ordem em que o wizard pede. */
  missing: ReadinessItem[];
};

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
