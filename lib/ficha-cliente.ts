/**
 * O resumo da ficha do cliente, a partir do que o banco já registra: itens
 * de atendimentos concluídos e agendamentos. Nada estimado — o que não tem
 * base aparece como null e a tela mostra "—".
 */
export type ItemDaFicha = {
  attendance_id: string;
  kind: string | null;
  final_price: number | string;
  servico: string | null;
  profissional: string | null;
};

export type ResumoDaFicha = {
  visitas: number;
  totalGasto: number;
  ticketMedio: number | null;
  servicosMaisUsados: { nome: string; vezes: number }[];
  profissionalPreferido: { nome: string; vezes: number } | null;
};

export function resumoDaFicha(itens: ItemDaFicha[], visitasConcluidas: number): ResumoDaFicha {
  const totalGasto = itens.reduce((soma, i) => soma + Number(i.final_price), 0);

  // Serviço conta uma vez por atendimento (o mesmo serviço duas vezes na
  // mesma visita é uma visita). Produto não é "serviço mais usado".
  const servicos = new Map<string, Set<string>>();
  const profissionais = new Map<string, Set<string>>();
  for (const i of itens) {
    if (i.kind === "product") continue;
    if (i.servico) (servicos.get(i.servico) ?? servicos.set(i.servico, new Set()).get(i.servico)!).add(i.attendance_id);
    if (i.profissional)
      (profissionais.get(i.profissional) ?? profissionais.set(i.profissional, new Set()).get(i.profissional)!).add(i.attendance_id);
  }
  const ordenar = (m: Map<string, Set<string>>) =>
    [...m.entries()]
      .map(([nome, s]) => ({ nome, vezes: s.size }))
      .sort((a, b) => b.vezes - a.vezes || a.nome.localeCompare(b.nome, "pt-BR"));

  const porProfissional = ordenar(profissionais);
  // "Preferido" só quando há escolha de fato: pelo menos duas visitas com a
  // mesma pessoa e sem empate no topo.
  const topo = porProfissional[0];
  const empate = porProfissional[1] && porProfissional[1].vezes === topo?.vezes;
  const profissionalPreferido = topo && topo.vezes >= 2 && !empate ? topo : null;

  return {
    visitas: visitasConcluidas,
    totalGasto,
    ticketMedio: visitasConcluidas > 0 ? totalGasto / visitasConcluidas : null,
    servicosMaisUsados: ordenar(servicos).slice(0, 3),
    profissionalPreferido,
  };
}
