/**
 * Analytics próprio do CORTEX — as regras, sem rede e sem banco.
 *
 * O que ESTE arquivo decide (e os testes travam):
 *   - de qual ambiente veio a visita (produção x Preview x local): só
 *     produção conta como tráfego real;
 *   - de onde veio a pessoa (canal), a partir do domínio de referência e dos
 *     cinco UTM — nunca da URL completa;
 *   - categoria de aparelho, navegador e sistema — nunca o User-Agent inteiro;
 *   - o consentimento, com GPC/DNT valendo como recusa;
 *   - quais eventos existem (lista fechada) e como a página é gravada (só o
 *     caminho, sem query string).
 *
 * Não guarda nada: quem guarda é a coleta (PENDENTE — REQUER ACESSO AO
 * SUPABASE). Sem imports: roda no navegador, no servidor e nos testes.
 */

// ── Ambiente ────────────────────────────────────────────────────────────────

/** Domínio oficial de produção hoje (único domínio de produção do projeto na Vercel). */
export const DOMINIO_DE_PRODUCAO = "fadeos-five.vercel.app";

export type Ambiente = "producao" | "preview" | "local";

export function ambienteDoHost(host: string | null | undefined): Ambiente {
  const h = (host ?? "").toLowerCase().split(":")[0];
  if (h === DOMINIO_DE_PRODUCAO) return "producao";
  if (!h || h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h.endsWith(".local")) return "local";
  return "preview";
}

// ── Páginas medidas ─────────────────────────────────────────────────────────

/** Só as páginas públicas de aquisição. Nada do produto, nada das barbearias. */
export const PAGINAS_DE_AQUISICAO = ["/", "/beta", "/login"] as const;
export type PaginaDeAquisicao = (typeof PAGINAS_DE_AQUISICAO)[number];

export function ehPaginaDeAquisicao(caminho: string): caminho is PaginaDeAquisicao {
  return (PAGINAS_DE_AQUISICAO as readonly string[]).includes(caminho);
}

/** Só o caminho: query string, hash e barra final ficam de fora. */
export function caminhoLimpo(url: string): string {
  const semHost = url.replace(/^[a-z]+:\/\/[^/]+/i, "");
  const caminho = semHost.split(/[?#]/)[0] || "/";
  return caminho.length > 1 ? caminho.replace(/\/+$/, "") : caminho;
}

// ── Origem ──────────────────────────────────────────────────────────────────

export const CHAVES_UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export type Utm = Partial<Record<(typeof CHAVES_UTM)[number], string>>;

/** Os cinco UTM e nada mais da query string; cada valor limpo e curto. */
export function lerUtm(search: string): Utm {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const utm: Utm = {};
  for (const k of CHAVES_UTM) {
    const v = params.get(k)?.trim().toLowerCase().replace(/[^\p{L}\p{N}_.\-+ ]/gu, "").slice(0, 100);
    if (v) utm[k] = v;
  }
  return utm;
}

/** Só o domínio de quem mandou a visita, sem "www." — nunca o endereço completo. */
export function dominioDeReferencia(referrer: string | null | undefined, hostAtual?: string): string | null {
  if (!referrer) return null;
  try {
    const h = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    if (!h || (hostAtual && h === hostAtual.toLowerCase().replace(/^www\./, ""))) return null;
    return h;
  } catch {
    return null;
  }
}

export type Canal =
  | "direto"
  | "busca_organica"
  | "instagram"
  | "facebook"
  | "whatsapp"
  | "outras_redes"
  | "campanha"
  | "referencia";

export const ROTULO_DO_CANAL: Record<Canal, string> = {
  direto: "Direto",
  busca_organica: "Google / busca orgânica",
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  outras_redes: "Outras redes",
  campanha: "Campanha",
  referencia: "Referência externa",
};

const BUSCADORES = /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|yahoo\.com|ecosia\.org|search\.brave\.com)$/;
const OUTRAS_REDES = /(^|\.)(t\.co|twitter\.com|x\.com|linkedin\.com|lnkd\.in|tiktok\.com|youtube\.com|youtu\.be|pinterest\.[a-z.]+|threads\.net|reddit\.com)$/;
const MEIOS_PAGOS = /^(cpc|ppc|paid|pago|ads|display|paid_social|paidsocial|patrocinado)$/;

/**
 * Canal da visita. Ordem: campanha paga (utm_medium) → rede nomeada no UTM ou
 * no domínio → busca → outras redes → referência → direto. WhatsApp quase
 * nunca manda referência: sem UTM nos links compartilhados, ele cai em
 * "direto" — por isso o painel recomenda UTM nesses links.
 */
export function canalDaVisita(dominio: string | null, utm: Utm): Canal {
  const fonte = utm.utm_source ?? "";
  const meio = utm.utm_medium ?? "";
  if (MEIOS_PAGOS.test(meio)) return "campanha";
  const alvo = `${fonte} ${dominio ?? ""}`;
  if (/instagram|(^|\s|\.)ig($|\s)/.test(alvo)) return "instagram";
  if (/whatsapp|wa\.me|(^|\s)wa($|\s)/.test(alvo)) return "whatsapp";
  if (/facebook|fb\.com|(^|\s)fb($|\s)|m\.facebook/.test(alvo)) return "facebook";
  if (dominio && BUSCADORES.test(dominio)) return "busca_organica";
  if (/google|bing/.test(fonte)) return meio === "organic" || !meio ? "busca_organica" : "campanha";
  if (dominio && OUTRAS_REDES.test(dominio)) return "outras_redes";
  if (fonte || utm.utm_campaign) return "campanha";
  if (dominio) return "referencia";
  return "direto";
}

// ── Aparelho ────────────────────────────────────────────────────────────────

export type Aparelho = {
  dispositivo: "celular" | "tablet" | "computador";
  navegador: "Chrome" | "Safari" | "Firefox" | "Edge" | "Samsung Internet" | "Opera" | "Outro";
  sistema: "Android" | "iOS" | "Windows" | "macOS" | "Linux" | "Outro";
};

const ROBOS = /bot|crawler|spider|crawling|headless|lighthouse|preview|facebookexternalhit|whatsapp\/|slurp|bingpreview|vercel-screenshot|prerender/i;

/** Robôs, pré-visualização de link (inclui a do próprio WhatsApp) e navegadores automatizados não contam. */
export function ehRobo(ua: string | null | undefined): boolean {
  return !ua || ROBOS.test(ua);
}

/** Categoria, nunca o texto: o User-Agent inteiro nunca sai daqui. */
export function aparelhoDoUserAgent(ua: string): Aparelho {
  const tablet = /ipad|tablet|(android(?!.*mobile))/i.test(ua);
  const celular = !tablet && /mobi|iphone|ipod|android/i.test(ua);
  const sistema: Aparelho["sistema"] = /android/i.test(ua)
    ? "Android"
    : /iphone|ipad|ipod/i.test(ua)
      ? "iOS"
      : /windows/i.test(ua)
        ? "Windows"
        : /mac os x|macintosh/i.test(ua)
          ? "macOS"
          : /linux/i.test(ua)
            ? "Linux"
            : "Outro";
  const navegador: Aparelho["navegador"] = /edg\//i.test(ua)
    ? "Edge"
    : /opr\/|opera/i.test(ua)
      ? "Opera"
      : /samsungbrowser/i.test(ua)
        ? "Samsung Internet"
        : /firefox|fxios/i.test(ua)
          ? "Firefox"
          : /chrome|crios/i.test(ua)
            ? "Chrome"
            : /safari/i.test(ua)
              ? "Safari"
              : "Outro";
  return { dispositivo: tablet ? "tablet" : celular ? "celular" : "computador", navegador, sistema };
}

// ── Consentimento ───────────────────────────────────────────────────────────

export const COOKIE_CONSENTIMENTO = "cortex-analytics";
export type Consentimento = "aceito" | "recusado" | "indefinido";

/**
 * O que vale de fato. GPC ou DNT ligados = recusa, sem perguntar. Sem
 * consentimento (recusado ou ainda não respondido), a visita ainda conta de
 * forma anônima — mas sem identificador de visitante, então sem "recorrente".
 */
export function consentimentoEfetivo(
  escolha: string | null | undefined,
  sinais: { gpc?: boolean; dnt?: string | null }
): Consentimento {
  if (sinais.gpc === true || sinais.dnt === "1" || sinais.dnt === "yes") return "recusado";
  if (escolha === "aceito" || escolha === "recusado") return escolha;
  return "indefinido";
}

/** A faixa só aparece para quem ainda não respondeu e não mandou GPC/DNT. */
export function deveMostrarFaixa(c: Consentimento): boolean {
  return c === "indefinido";
}

// ── Eventos ─────────────────────────────────────────────────────────────────

/** Lista fechada. Nada fora daqui é aceito — sem rastrear cada clique. */
export const EVENTOS = [
  "session_start",
  "page_view",
  "cta_click",
  "whatsapp_click",
  "signup_started",
  "signup_completed",
  "beta_request_started",
  "beta_request_completed",
  "login",
] as const;
export type NomeDoEvento = (typeof EVENTOS)[number];

export function ehEventoValido(nome: string): nome is NomeDoEvento {
  return (EVENTOS as readonly string[]).includes(nome);
}

/** O que um clique significa, pelo destino do link (sem marcar cada botão). */
export function eventoDoClique(href: string | null | undefined): NomeDoEvento | null {
  if (!href) return null;
  if (/wa\.me|api\.whatsapp\.com|whatsapp:\/\//i.test(href)) return "whatsapp_click";
  const caminho = caminhoLimpo(href);
  if (caminho === "/beta") return "cta_click";
  return null;
}
