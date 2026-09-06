"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string };
type NavGroup = { label: string; items: NavItem[] };
export type NavScope = "manager" | "reception" | "barber";

const ALL_GROUPS: NavGroup[] = [
  {
    label: "Operação",
    items: [
      { href: "/agenda", label: "Agenda" },
      { href: "/atendimento", label: "Atendimento" },
      { href: "/pdv", label: "PDV" },
      { href: "/caixa", label: "Caixa" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/clientes", label: "Clientes" },
      { href: "/profissionais", label: "Profissionais" },
      { href: "/servicos", label: "Serviços" },
      { href: "/produtos", label: "Produtos" },
      { href: "/materiais", label: "Materiais" },
      { href: "/estoque", label: "Estoque" },
      { href: "/vendas", label: "Vendas" },
      { href: "/comissoes", label: "Comissões" },
      { href: "/financeiro", label: "Financeiro" },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/kpis", label: "KPIs" },
      { href: "/relatorios", label: "Relatórios" },
      { href: "/inteligencia", label: "Central" },
    ],
  },
  {
    label: "Empresa",
    items: [{ href: "/configuracoes", label: "Configurações" }],
  },
];

// Recepção: opera o dia a dia, mas não vê números do negócio nem
// configura a empresa. Barbeiro: só o próprio contexto (a Central vira
// "Minha Central" na própria página, escopada por lib/permissions.ts —
// aqui só decide quais itens de menu aparecem).
const SCOPE_ALLOWED_HREFS: Record<NavScope, Set<string> | null> = {
  manager: null,
  reception: new Set(["/agenda", "/atendimento", "/pdv", "/caixa", "/clientes"]),
  barber: new Set(["/agenda", "/atendimento", "/clientes", "/inteligencia"]),
};

export function AppNav({ scope = "manager" }: { scope?: NavScope }) {
  const pathname = usePathname();
  const allowed = SCOPE_ALLOWED_HREFS[scope];

  const groups = ALL_GROUPS.map((group) => ({
    ...group,
    items: allowed ? group.items.filter((item) => allowed.has(item.href)) : group.items,
  })).filter((group) => group.items.length > 0);

  return (
    <nav
      className="shell flex gap-7 overflow-x-auto"
      aria-label="Navegação principal"
    >
      {groups.map((group) => (
        <div key={group.label} className="flex items-baseline gap-3 shrink-0">
          <span className="text-label uppercase text-disabled select-none hidden lg:inline">
            {group.label}
          </span>
          <div className="flex gap-5">
            {group.items.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "text-nav py-2.5 border-b-2 whitespace-nowrap transition-colors duration-fast ease-standard",
                    active
                      ? "border-signal text-foreground"
                      : "border-transparent text-muted hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
