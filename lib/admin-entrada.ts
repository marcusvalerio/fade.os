/**
 * Entrada do CORTEX ADMIN — as rotas que existem ANTES de alguém ser
 * reconhecido como administrador da plataforma.
 *
 * O middleware deixa só estas passarem sem a checagem de platform admin, e o
 * layout do Admin as mostra sem o console (sem navegação, sem sino, sem
 * dados). Qualquer outra rota /admin/* exige administrador ativo antes de a
 * página começar a carregar.
 */
export const ROTAS_PUBLICAS_DO_ADMIN = ["/admin/login", "/admin/esqueci-senha", "/admin/redefinir-senha"] as const;

export function ehRotaPublicaDoAdmin(pathname: string): boolean {
  return (ROTAS_PUBLICAS_DO_ADMIN as readonly string[]).includes(pathname);
}

export function ehRotaDoAdmin(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** Cookie curto que diz ao callback de recuperação para voltar ao Admin. */
export const COOKIE_RECUPERACAO = "cortex-recuperacao";
export const DESTINO_RECUPERACAO_ADMIN = "admin";

/** Cabeçalho que o middleware põe na requisição para o layout saber a rota. */
export const CABECALHO_ROTA = "x-cortex-rota";

/**
 * Para onde voltar depois de entrar: só caminhos internos do próprio Admin.
 * Qualquer outra coisa (URL externa, //host, rota do app) vira /admin.
 */
export function destinoDepoisDaEntrada(proximo: string | null | undefined): string {
  if (!proximo || !proximo.startsWith("/admin") || proximo.startsWith("//") || ehRotaPublicaDoAdmin(proximo.split("?")[0])) {
    return "/admin";
  }
  return proximo;
}
