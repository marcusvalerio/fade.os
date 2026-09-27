/**
 * O Pulso da operação — o que está acontecendo agora e o que pede ação.
 *
 * Só contas sobre dados que o CORTEX já tem (agenda do dia, atendimentos,
 * caixa, ritmo dos clientes, estoque, comissões). Nenhum sinal é inventado
 * nem enviado a ninguém: cada um é uma contagem real com o lugar onde se
 * resolve. Sem nada pedindo atenção, o Pulso diz isso — não enche a tela.
 */
export type DadosDoPulso = {
  emAtendimento: number;
  aguardando: number;
  restantes: number;
  concluidos: number;
  atrasados: number;
  pendentesConfirmacao: number;
  atendimentosEsquecidos: number;
  caixaAberto: boolean;
  atendimentosHoje: number;
  clientesParaChamar: number;
  estoqueCritico: number;
  comissoesDevidas: number;
};

export type Tom = "perigo" | "atencao" | "info" | "neutro";

export type Sinal = { chave: string; tom: Tom; titulo: string; detalhe: string; href: string; acao: string };

const ORDEM: Record<Tom, number> = { perigo: 0, atencao: 1, info: 2, neutro: 3 };

function plural(n: number, um: string, varios: string) {
  return n === 1 ? um : varios;
}

export function sinaisDoPulso(d: DadosDoPulso, formatarMoeda: (v: number) => string): Sinal[] {
  const sinais: Sinal[] = [];

  if (d.atrasados > 0) {
    sinais.push({
      chave: "atrasados",
      tom: "perigo",
      titulo: `${d.atrasados} ${plural(d.atrasados, "horário passou", "horários passaram")} do início sem o cliente chegar`,
      detalhe: "Marque a chegada, reagende ou registre que não compareceu.",
      href: "/agenda",
      acao: "Abrir agenda",
    });
  }
  if (d.atendimentosEsquecidos > 0) {
    sinais.push({
      chave: "esquecidos",
      tom: "atencao",
      titulo: `${d.atendimentosEsquecidos} ${plural(d.atendimentosEsquecidos, "atendimento aberto", "atendimentos abertos")} de dias anteriores`,
      detalhe: "Enquanto não fecha, a venda, o caixa e a comissão não existem.",
      href: "/atendimento",
      acao: "Ver atendimentos",
    });
  }
  if (d.pendentesConfirmacao > 0) {
    sinais.push({
      chave: "confirmacao",
      tom: "atencao",
      titulo: `${d.pendentesConfirmacao} ${plural(d.pendentesConfirmacao, "horário de hoje aguarda", "horários de hoje aguardam")} confirmação`,
      detalhe: "A mensagem de confirmação já vem pronta no WhatsApp de cada linha.",
      href: "/agenda?pendentes=1",
      acao: "Ver pendentes",
    });
  }
  if (!d.caixaAberto && (d.restantes > 0 || d.emAtendimento > 0 || d.aguardando > 0)) {
    sinais.push({
      chave: "caixa",
      tom: "atencao",
      titulo: "Caixa fechado com atendimentos pela frente",
      detalhe: "Sem caixa aberto, dinheiro não aparece como forma de pagamento.",
      href: "/caixa",
      acao: "Abrir caixa",
    });
  }
  if (d.estoqueCritico > 0) {
    sinais.push({
      chave: "estoque",
      tom: "atencao",
      titulo: `${d.estoqueCritico} ${plural(d.estoqueCritico, "item no", "itens no")} estoque mínimo ou abaixo`,
      detalhe: "Venda e atendimento continuam baixando o saldo.",
      href: "/estoque",
      acao: "Ver estoque",
    });
  }
  if (d.clientesParaChamar > 0) {
    sinais.push({
      chave: "clientes",
      tom: "info",
      titulo: `${d.clientesParaChamar} ${plural(d.clientesParaChamar, "cliente passou", "clientes passaram")} do próprio ritmo de volta`,
      detalhe: "A lista mostra há quanto tempo cada um não vem — o contato é seu.",
      href: "/clientes",
      acao: "Ver clientes",
    });
  }
  if (d.comissoesDevidas > 0) {
    sinais.push({
      chave: "comissoes",
      tom: "neutro",
      titulo: `${formatarMoeda(d.comissoesDevidas)} em comissões devidas`,
      detalhe: "Geradas sozinhas no fechamento de cada atendimento.",
      href: "/comissoes",
      acao: "Ver comissões",
    });
  }

  return sinais.sort((a, b) => ORDEM[a.tom] - ORDEM[b.tom]);
}

/** A frase de abertura: o agora, em uma linha. */
export function agoraEmUmaFrase(d: DadosDoPulso, proximo: { hora: string; cliente: string } | null): string {
  const partes: string[] = [];
  if (d.emAtendimento > 0) partes.push(`${d.emAtendimento} em atendimento`);
  if (d.aguardando > 0) partes.push(`${d.aguardando} ${plural(d.aguardando, "aguardando", "aguardando")}`);
  if (partes.length > 0) return partes.join(" · ") + (proximo ? ` · próximo às ${proximo.hora}` : "");
  if (proximo) return `Ninguém na cadeira agora · próximo às ${proximo.hora}, ${proximo.cliente}`;
  if (d.concluidos > 0) return `Dia sem mais horários · ${d.concluidos} ${plural(d.concluidos, "atendimento concluído", "atendimentos concluídos")}`;
  return "Nenhum horário marcado para hoje";
}
