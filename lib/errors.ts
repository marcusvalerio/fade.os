import { TenancyError } from "@/lib/tenancy";

type PostgrestLikeError = { code?: string; message: string };

const GENERIC_MESSAGE = "Não foi possível concluir a ação. Tente novamente.";

const CODE_MESSAGES: Record<string, string> = {
  "23505": "Já existe um registro com esses dados.",
  "23P01": "Esse profissional já tem outro compromisso nesse horário.",
  "23503": "Um dos itens selecionados não existe mais ou foi removido.",
  "42501": "Você não tem permissão para fazer isso.",
};

/**
 * As funções SECURITY INVOKER da Fase 4 (close_attendance, cancel_sale,
 * adjust_stock, open/close_cash_session) levantam `raise exception` com um
 * texto-código curto em vez de uma mensagem já pronta — a tradução fica
 * centralizada aqui, igual ao padrão criado na Fase 3 pra camada pública.
 */
const DOMAIN_MESSAGES: Record<string, string> = {
  ATENDIMENTO_NAO_ENCONTRADO: "Atendimento não encontrado.",
  ATENDIMENTO_JA_FECHADO: "Este atendimento já foi fechado.",
  ATENDIMENTO_SEM_ITENS: "Adicione ao menos um item antes de fechar o atendimento.",
  VALOR_INVALIDO: "Valor inválido.",
  DESCONTO_MAIOR_QUE_SUBTOTAL: "O desconto não pode ser maior que o subtotal.",
  PAGAMENTO_NAO_CONFERE: "A soma dos pagamentos não bate com o total da venda.",
  VALOR_PAGAMENTO_INVALIDO: "Informe um valor de pagamento válido.",
  METODO_PAGAMENTO_INVALIDO: "Essa forma de pagamento não está habilitada.",
  VENDA_NAO_ENCONTRADA: "Venda não encontrada.",
  VENDA_JA_CANCELADA: "Esta venda já foi cancelada.",
  MOTIVO_OBRIGATORIO: "Informe o motivo do cancelamento.",
  TIPO_INVALIDO: "Tipo de item inválido.",
  MOVIMENTO_INVALIDO: "Tipo de movimentação inválido.",
  QUANTIDADE_INVALIDA: "Informe uma quantidade válida.",
  CAIXA_NAO_ENCONTRADO: "Caixa não encontrado.",
  CAIXA_JA_ABERTO: "Já existe uma sessão de caixa aberta para este caixa.",
  SESSAO_NAO_ENCONTRADA: "Sessão de caixa não encontrada.",
  SESSAO_JA_FECHADA: "Esta sessão de caixa já foi fechada.",
  VENDA_SEM_ITENS: "Adicione ao menos um produto antes de finalizar a venda.",
  CLIENTE_INVALIDO: "Cliente inválido para esta empresa.",
  PRODUTO_INVALIDO: "Esse produto não está disponível.",
  ESTOQUE_INSUFICIENTE: "Estoque insuficiente para essa quantidade.",

  // Integridade financeira (FASE 4) e estoque (FASE 5).
  VENDA_SEM_PAGAMENTO: "Informe como o cliente pagou antes de finalizar.",
  DESCONTO_NAO_AUTORIZADO: "Desconto precisa do código de autorização do responsável.",
  ITEM_ESTOQUE_INVALIDO: "Esse item não está disponível nesta unidade.",
  UNIDADE_INVALIDA: "Unidade inválida para esta empresa.",

  // Disponibilidade da agenda (FASE 6).
  AGENDAMENTO_SEM_SERVICOS: "Adicione ao menos um serviço ao agendamento.",
  HORARIO_INVALIDO: "Informe um horário válido.",
  HORARIO_INDISPONIVEL: "Esse horário já está ocupado.",
  FORA_DO_FUNCIONAMENTO: "A unidade não está aberta nesse horário.",
  FORA_DA_JORNADA: "Esse horário está fora da jornada do profissional.",
  PROFISSIONAL_BLOQUEADO: "O profissional tem um bloqueio nesse horário.",
  PROFISSIONAL_AUSENTE: "O profissional está ausente nesse período.",
  PROFISSIONAL_NAO_HABILITADO: "Esse profissional não realiza esse serviço.",
  PROFISSIONAL_INVALIDO: "Esse profissional não está disponível nesta unidade.",
  SERVICO_INVALIDO: "Esse serviço não está disponível.",

  // Código de autorização (desconto / cortesia).
  CODIGO_AUTORIZACAO_INVALIDO: "Código de autorização inválido.",
  CORTESIA_NAO_AUTORIZADA: "Cortesia precisa do código de autorização do responsável.",
  MOTIVO_CORTESIA_OBRIGATORIO: "Informe o motivo da cortesia.",
  OPERACAO_INVALIDA: "Operação não reconhecida.",
  PRECO_ORIGINAL_IMUTAVEL: "O preço deste item não pode ser alterado depois de lançado.",
  ITEM_NAO_ENCONTRADO: "Item não encontrado.",

  // Acesso profissional (BLOCO B).
  ACESSO_EMPRESA_DIVERGENTE: "O acesso não pertence à empresa deste profissional.",
  ACESSO_NAO_ENCONTRADO: "Este profissional ainda não possui acesso.",
  IDENTIFICADOR_INDISPONIVEL: "Não foi possível gerar o identificador. Tente novamente.",
};

const AUTH_MESSAGE_MATCHERS: [RegExp, string][] = [
  [/already registered/i, "Já existe uma conta com esse e-mail."],
  [/invalid login credentials/i, "E-mail ou senha incorretos."],
  [/password should be at least/i, "A senha precisa ter pelo menos 8 caracteres."],
  [/unable to validate email/i, "Informe um e-mail válido."],
  [/email rate limit/i, "Muitas tentativas. Aguarde um instante e tente de novo."],
];

/** Mensagens de auth do Supabase já vêm em inglês — traduz as mais comuns. */
export function friendlyAuthMessage(message: string): string {
  const match = AUTH_MESSAGE_MATCHERS.find(([pattern]) => pattern.test(message));
  return match ? match[1] : "Não foi possível concluir. Tente novamente.";
}

/**
 * Converte um erro técnico do Postgres/Supabase numa mensagem que faz
 * sentido pro usuário (seção 29). O erro original é sempre logado no
 * servidor para debugging — nunca silenciado, só não exposto na tela.
 */
export function friendlyMessage(error: unknown): string {
  if (error instanceof TenancyError) return error.message;

  if (typeof error === "object" && error !== null && "message" in error) {
    const pgError = error as PostgrestLikeError;
    console.error("[fade-os] erro de banco:", pgError.code, pgError.message);

    if (pgError.message && DOMAIN_MESSAGES[pgError.message]) {
      return DOMAIN_MESSAGES[pgError.message];
    }

    if (pgError.code && CODE_MESSAGES[pgError.code]) {
      return CODE_MESSAGES[pgError.code];
    }

    if (pgError.message?.toLowerCase().includes("row-level security")) {
      return "Você não tem permissão para fazer isso.";
    }

    if (pgError.message?.toLowerCase().includes("já concluído")) {
      return pgError.message;
    }
  }

  if (error instanceof Error) {
    console.error("[fade-os] erro inesperado:", error);
  }

  return GENERIC_MESSAGE;
}
