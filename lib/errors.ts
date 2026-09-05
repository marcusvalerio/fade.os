import { TenancyError } from "@/lib/tenancy";

type PostgrestLikeError = { code?: string; message: string };

const GENERIC_MESSAGE = "Não foi possível concluir a ação. Tente novamente.";

const CODE_MESSAGES: Record<string, string> = {
  "23505": "Já existe um registro com esses dados.",
  "23P01": "Esse profissional já tem outro compromisso nesse horário.",
  "23503": "Um dos itens selecionados não existe mais ou foi removido.",
  "42501": "Você não tem permissão para fazer isso.",
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
