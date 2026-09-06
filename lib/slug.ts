/**
 * Normalização de slug — espelha exatamente public.slugify() em
 * supabase/migrations/20260908150000_phase3_public_slug_and_booking.sql.
 * Usado só para prévia instantânea no cliente (ex.: "seu link será:
 * fade.os/barbeariadojoao" enquanto o dono digita) — a fonte de verdade
 * para geração/unicidade continua sendo a função set_company_slug() no
 * banco, que roda com SECURITY DEFINER e enxerga todos os slugs.
 */
export function slugify(input: string): string {
  const normalized = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.slice(0, 63) || "barbearia";
}

/**
 * Mesma lista de supabase/migrations/…_phase3_public_slug_and_booking.sql
 * (tabela reserved_slug) — duplicada deliberadamente: o banco é quem
 * realmente impede a colisão (trigger + unique index), esta cópia só
 * evita uma ida ao servidor para mostrar o erro óbvio antes de submeter.
 */
export const RESERVED_SLUGS = new Set([
  "login", "criar-conta", "onboarding", "admin", "agenda", "atendimento",
  "clientes", "configuracoes", "inteligencia", "materiais", "produtos",
  "profissionais", "servicos", "dashboard", "financeiro", "estoque",
  "caixa", "crm", "api", "auth", "public", "static", "assets", "favicon",
  "robots", "sitemap", "_next", "www", "app", "sobre", "ajuda", "termos",
  "privacidade", "agendar", "agendamentos", "vendas", "comissoes", "kpis",
  "relatorios", "pdv",
]);

export function isSlugFormatValid(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= 63;
}

export function isSlugReserved(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}
