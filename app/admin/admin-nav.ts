/**
 * Arquitetura de informação do CORTEX ADMIN — um único lugar que descreve
 * a navegação, consumido pela sidebar (desktop/tablet) e pelo seletor
 * (mobile) em AdminNavLinks.tsx. Cada entrada é uma seção real da
 * plataforma; nenhuma existe só para preencher a lista — as que ainda não
 * têm backend (ver docs/ADMIN.md) apontam para uma página que diz isso
 * com todas as letras, nunca para dado inventado.
 */
export type AdminNavEntry = {
  href: string;
  label: string;
};

export type AdminNavGroup = {
  label: string;
  entries: AdminNavEntry[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Plataforma",
    entries: [
      { href: "/admin", label: "Central" },
      { href: "/admin/uso", label: "Produto" },
      { href: "/admin/sistema", label: "Saúde" },
    ],
  },
  {
    label: "Beta",
    entries: [{ href: "/admin/pesquisas", label: "Pesquisas" }],
  },
  {
    label: "Barbearias",
    entries: [
      { href: "/admin/empresas", label: "Empresas" },
      { href: "/admin/acessos", label: "Acessos Beta" },
      { href: "/admin/usuarios", label: "Usuários" },
    ],
  },
  {
    label: "Governança",
    entries: [
      { href: "/admin/auditoria", label: "Auditoria" },
      { href: "/admin/usuarios/permissoes", label: "Permissões" },
      { href: "/admin/usuarios/sessoes", label: "Sessões" },
      { href: "/admin/configuracoes", label: "Configurações" },
    ],
  },
  {
    // Áreas sem integração no código: cada uma abre uma página que diz
    // isso — ficam agrupadas para não se passarem por módulos ativos.
    label: "Não conectado",
    entries: [
      { href: "/admin/erros", label: "Erros" },
      { href: "/admin/jobs", label: "Jobs" },
      { href: "/admin/webhooks", label: "Webhooks" },
      { href: "/admin/assinaturas", label: "Assinaturas" },
      { href: "/admin/transacoes", label: "Transações" },
    ],
  },
];

export const ADMIN_NAV_FLAT: AdminNavEntry[] = ADMIN_NAV_GROUPS.flatMap((g) => g.entries);

export function isAdminNavActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}
