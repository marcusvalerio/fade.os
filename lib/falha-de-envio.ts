/**
 * As duas frases de falha de envio do CORTEX.
 *
 * Validação e regra de negócio já chegam com a frase certa, escrita pelo
 * servidor — essas continuam aparecendo como são. Esta é a frase para o que
 * sobra: a conexão caiu, o servidor não respondeu, uma exceção que ninguém
 * previu. Uma das duas, igual em toda tela; nunca o texto técnico ("Failed
 * to fetch", "NEXT_REDIRECT", stack trace).
 */
export const MENSAGEM_SEM_CONEXAO = "Não foi possível conectar ao CORTEX. Verifique sua conexão e tente novamente.";
export const MENSAGEM_FALHA_AO_SALVAR = "Não foi possível salvar. Revise os dados e tente novamente.";

/**
 * - "rede": o pedido não chegou (offline, DNS, conexão cortada). É da conexão
 *   da pessoa, não do sistema — não vai para o Sentry.
 * - "resposta": chegou uma resposta que não é do app (502/504 do gateway,
 *   tempo esgotado, página de erro de proxy). Vai para o Sentry.
 * - "excecao": qualquer outra coisa. Vai para o Sentry.
 */
export type TipoDeFalha = "rede" | "resposta" | "excecao";

// Como Chrome, Firefox, Safari e o fetch do Node descrevem um pedido que não chegou.
const PEDIDO_QUE_NAO_CHEGOU = [/failed to fetch/i, /networkerror/i, /network error/i, /load failed/i, /network request failed/i, /fetch failed/i];
// O Next usa esta frase quando a resposta de uma Server Action não é do app.
const RESPOSTA_QUE_NAO_E_DO_APP = /unexpected response was received from the server/i;

function texto(erro: unknown) {
  if (erro instanceof Error) return `${erro.name}: ${erro.message}`;
  return typeof erro === "string" ? erro : "";
}

function navegadorOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

export function classificarFalha(erro: unknown, online = navegadorOnline()): TipoDeFalha {
  const t = texto(erro);
  if (RESPOSTA_QUE_NAO_E_DO_APP.test(t)) return "resposta";
  if (!online || PEDIDO_QUE_NAO_CHEGOU.some((sinal) => sinal.test(t))) return "rede";
  return "excecao";
}

export function mensagemDaFalha(tipo: TipoDeFalha): string {
  return tipo === "excecao" ? MENSAGEM_FALHA_AO_SALVAR : MENSAGEM_SEM_CONEXAO;
}
