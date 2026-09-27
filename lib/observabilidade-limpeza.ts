/**
 * Limpeza de eventos antes de irem para o Sentry — pura e testada, sem
 * importar o SDK (roda igual no navegador, no servidor e no edge).
 *
 * O que NUNCA sai daqui: senha, token, chave, cookie, cabeçalho de
 * autenticação, corpo de formulário, e-mail, telefone, CPF/CNPJ, JWT e
 * qualquer UUID em URL — o link de agendamento do cliente
 * (/[slug]/agendamentos/<token>) é um token de acesso.
 *
 * O que fica: rota (com :id no lugar dos identificadores), mensagem do erro
 * já limpa, pilha, release, ambiente, e as tags que o próprio CORTEX
 * coloca (id do usuário, id da empresa, papel) — ids, nunca nomes.
 */

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const BEARER = /\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const CNPJ = /\b[0-9A-Z]{2}\.?[0-9A-Z]{3}\.?[0-9A-Z]{3}\/?[0-9A-Z]{4}-?\d{2}\b/g;
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const TELEFONE = /(?:\+?55\s?)?\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g;

const CHAVE_SENSIVEL = /pass|senha|token|secret|segredo|key|chave|cookie|auth|session|sess[aã]o|cpf|cnpj|document|phone|telefone|whatsapp|email|e-mail/i;

export function limparTexto(t: string): string {
  return t
    .replace(JWT, "[token]")
    .replace(BEARER, "$1 [token]")
    .replace(EMAIL, "[email]")
    .replace(CNPJ, "[documento]")
    .replace(CPF, "[documento]")
    .replace(TELEFONE, "[telefone]");
}

/** URL sem query string com valor e sem identificadores no caminho. */
export function limparUrl(url: string): string {
  const [base, query] = url.split("?");
  const semIds = base.replace(UUID, ":id");
  if (!query) return semIds;
  const chaves = query
    .split("&")
    .map((par) => par.split("=")[0])
    .filter(Boolean);
  return chaves.length ? `${semIds}?${chaves.map((c) => `${c}=[removido]`).join("&")}` : semIds;
}

function limparValor(v: unknown, profundidade = 0): unknown {
  if (profundidade > 6) return "[profundo]";
  if (typeof v === "string") return limparTexto(v);
  if (Array.isArray(v)) return v.map((x) => limparValor(x, profundidade + 1));
  if (v && typeof v === "object") {
    const saida: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      saida[k] = CHAVE_SENSIVEL.test(k) ? "[removido]" : limparValor(x, profundidade + 1);
    }
    return saida;
  }
  return v;
}

type Quebra = { category?: string; message?: string; data?: Record<string, unknown> };

// Estrutura mínima do evento do Sentry que a limpeza toca — sem depender do
// tipo do SDK, para ficar testável isolada.
export type EventoBruto = {
  message?: string;
  transaction?: string;
  request?: {
    url?: string;
    query_string?: unknown;
    cookies?: unknown;
    headers?: Record<string, string>;
    data?: unknown;
    env?: unknown;
  };
  exception?: { values?: { type?: string; value?: string }[] };
  breadcrumbs?: Quebra[];
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  user?: Record<string, unknown>;
  tags?: Record<string, unknown>;
};

const CABECALHOS_PERMITIDOS = new Set(["user-agent", "accept-language", "referer", "content-type", "next-action"]);

export function limparEvento<T extends EventoBruto>(evento: T): T {
  const e = evento;
  if (e.message) e.message = limparTexto(e.message);
  if (e.transaction) e.transaction = limparUrl(e.transaction);

  if (e.request) {
    delete e.request.cookies;
    delete e.request.data;
    delete e.request.env;
    delete e.request.query_string;
    if (e.request.url) e.request.url = limparUrl(e.request.url);
    if (e.request.headers) {
      const h: Record<string, string> = {};
      for (const [k, v] of Object.entries(e.request.headers)) {
        if (CABECALHOS_PERMITIDOS.has(k.toLowerCase())) h[k] = k.toLowerCase() === "referer" ? limparUrl(String(v)) : String(v);
      }
      e.request.headers = h;
    }
  }

  for (const ex of e.exception?.values ?? []) {
    if (ex.value) ex.value = limparTexto(ex.value);
  }

  if (e.breadcrumbs) {
    e.breadcrumbs = e.breadcrumbs.map((b) => limparQuebra(b));
  }

  if (e.extra) e.extra = limparValor(e.extra) as Record<string, unknown>;
  if (e.contexts) {
    const c = { ...e.contexts };
    // Estado do app e respostas de ação podem carregar dados de cliente.
    delete c.state;
    e.contexts = limparValor(c) as Record<string, unknown>;
  }

  // Usuário: só o id. Nada de e-mail, nome, IP.
  if (e.user) e.user = e.user.id ? { id: String(e.user.id) } : {};
  return e;
}

export function limparQuebra<T extends Quebra>(b: T): T {
  const q = { ...b };
  if (q.message) q.message = limparTexto(q.message);
  if (q.data) {
    const d: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(q.data)) {
      if (k === "url" || k === "from" || k === "to") d[k] = limparUrl(String(v));
      else d[k] = CHAVE_SENSIVEL.test(k) ? "[removido]" : limparValor(v);
    }
    q.data = d;
  }
  return q;
}

// Spans (desempenho): nome e atributos carregam URL, rota e às vezes
// parâmetros de consulta ao banco. Mesma regra do evento.
type SpanBruto = { name: string; attributes: Record<string, unknown> };
const ATRIBUTO_DE_URL = /url|target|route|path|http\.query|referer/i;

export function limparSpan<T extends SpanBruto>(span: T): T {
  span.name = limparTexto(span.name.replace(UUID, ":id"));
  const a: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(span.attributes ?? {})) {
    if (CHAVE_SENSIVEL.test(k) && !/^sentry\./.test(k)) a[k] = "[removido]";
    else if (typeof v === "string" && ATRIBUTO_DE_URL.test(k)) a[k] = limparUrl(v);
    else a[k] = typeof v === "string" ? limparTexto(v) : v;
  }
  span.attributes = a;
  return span;
}
