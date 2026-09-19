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
    entries: [{ href: "/admin", label: "Visão geral" }],
  },
  {
    label: "Empresas",
    entries: [
      { href: "/admin/empresas", label: "Empresas" },
      { href: "/admin/acessos", label: "Acessos Beta" },
      { href: "/admin/assinaturas", label: "Assinaturas" },
      { href: "/admin/transacoes", label: "Transações" },
    ],
  },
  {
    label: "Contas",
    entries: [
      { href: "/admin/usuarios", label: "Usuários" },
      { href: "/admin/usuarios/sessoes", label: "Sessões" },
      { href: "/admin/usuarios/permissoes", label: "Permissões" },
    ],
  },
  {
    label: "Observabilidade",
    entries: [
      { href: "/admin/sistema", label: "System Health" },
      { href: "/admin/erros", label: "Erros" },
      { href: "/admin/webhooks", label: "Webhooks" },
      { href: "/admin/jobs", label: "Jobs / Workers" },
      { href: "/admin/uso", label: "Uso" },
    ],
  },
  {
    label: "Governança",
    entries: [
      { href: "/admin/auditoria", label: "Segurança" },
      { href: "/admin/configuracoes", label: "Configurações" },
    ],
  },
];

export const ADMIN_NAV_FLAT: AdminNavEntry[] = ADMIN_NAV_GROUPS.flatMap((g) => g.entries);

export function isAdminNavActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}
