/**
 * A entrada no CORTEX — o sinal que diz "acabou de entrar".
 *
 * Um cookie curto (2 min), marcado no navegador no instante em que alguém
 * envia o login (ou sai para o Google/Apple, ou conclui o onboarding). O
 * layout autenticado lê o cookie no servidor e, se ele existir, já manda a
 * sequência da marca no HTML (components/entrada-cortex.tsx) — a animação
 * começa no primeiro paint, sem esperar JavaScript e sem o produto piscar
 * antes. O componente apaga o cookie ao montar: a sequência acontece uma vez
 * por login, nunca a cada navegação.
 *
 * Não é sessão nem autorização — é só um aviso de interface. Se o login
 * falhar, o cookie expira sozinho (e a tela de login o apaga ao mostrar o
 * erro).
 */
export const COOKIE_ENTRADA = "cortex-entrada";

export function marcarEntrada() {
  document.cookie = `${COOKIE_ENTRADA}=1; Max-Age=120; Path=/; SameSite=Lax`;
}

export function desmarcarEntrada() {
  document.cookie = `${COOKIE_ENTRADA}=; Max-Age=0; Path=/; SameSite=Lax`;
}
