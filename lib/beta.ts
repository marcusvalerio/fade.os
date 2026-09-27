/**
 * Posicionamento comercial durante o beta — um lugar só para os números e
 * datas que aparecem na interface.
 *
 * O CORTEX é um produto pago. O preço final ainda NÃO está definido no
 * sistema: PRECO_REFERENCIA_MENSAL é uma referência visual (aparece riscado,
 * rotulado como referência), não um preço comercial. Não existe cobrança,
 * contratação nem integração de pagamento nesta fase.
 *
 * Dezembro é deliberadamente parte do beta (é o mês de maior movimento das
 * barbearias — o teste real mais importante); os planos só abrem depois.
 */
export const PRECO_REFERENCIA_MENSAL = 200;

export const PLANOS_DISPONIVEIS_A_PARTIR_DE = "janeiro de 2027";

/** O que o plano inclui — só módulos que existem hoje no produto. */
export const O_QUE_O_PLANO_INCLUI = [
  "Agenda da equipe e página de agendamento da barbearia",
  "Atendimento, vendas no balcão e caixa",
  "Financeiro, comissões e estoque",
  "Clientes, histórico e conta do cliente",
] as const;

export const MENSAGEM_DO_BETA =
  "Neste período, sua operação é acompanhada para entendermos como cada funcionalidade é usada, onde há dificuldade e o que evoluir — com base no uso real.";
