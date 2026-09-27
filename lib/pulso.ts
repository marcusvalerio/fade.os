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
  /** Clientes que chegaram (status "aguardando") há mais de 15 minutos. */
  esperandoMuito: number;
  caixaAberto: boolean;
  atendimentosHoje: number;
  clientesParaChamar: number;
  estoqueCritico: number;
  comissoesDevidas: number;
};

/**
 * Quatro níveis, para nem tudo virar alerta vermelho:
 *   critico     alguém está sendo afetado agora (cliente esperando)
 *   importante  pode virar perda hoje (horário furando, caixa fechado)
 *   atencao     precisa de uma mão, mas não hoje à tarde
 *   info        oportunidade ou pendência sem pressa
 */
export type Nivel = "critico" | "importante" | "atencao" | "info";

export const ROTULO_DO_NIVEL: Record<Nivel, string> = {
  critico: "Crítico",
  importante: "Importante",
  atencao: "Atenção",
  info: "Informativo",
};

export type Sinal = { chave: string; tom: Nivel; titulo: string; detalhe: string; href: string; acao: string };

const ORDEM: Record<Nivel, number> = { critico: 0, importante: 1, atencao: 2, info: 3 };

function plural(n: number, um: string, varios: string) {
  return n === 1 ? um : varios;
}

export function sinaisDoPulso(d: DadosDoPulso, formatarMoeda: (v: number) => string): Sinal[] {
  const sinais: Sinal[] = [];

  if (d.esperandoMuito > 0) {
    sinais.push({
      chave: "esperando",
      tom: "critico",
      titulo: `${d.esperandoMuito} ${plural(d.esperandoMuito, "cliente aguardando", "clientes aguardando")} há mais de 15 min`,
      detalhe: "Já chegaram e ainda não começaram. Inicie o atendimento ou avise quanto falta.",
      href: "/agenda",
      acao: "Ver na agenda",
    });
  }
  if (d.atrasados > 0) {
    sinais.push({
      chave: "atrasados",
      tom: "importante",
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
      tom: "importante",
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
      tom: "info",
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
