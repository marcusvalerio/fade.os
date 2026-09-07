"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string };
type NavEntry =
  | { type: "link"; href: string; label: string }
  | { type: "menu"; label: string; items: NavItem[] };
export type NavScope = "manager" | "reception" | "barber";

const ALL_ENTRIES: NavEntry[] = [
  { type: "link", href: "/dashboard", label: "Início" },
  {
    type: "menu",
    label: "Agenda",
    items: [
      { href: "/agenda", label: "Agenda" },
      { href: "/atendimento", label: "Atendimento" },
    ],
  },
  { type: "link", href: "/clientes", label: "Clientes" },
  {
    type: "menu",
    label: "Negócio",
    items: [
      { href: "/pdv", label: "Nova venda" },
      { href: "/vendas", label: "Vendas" },
      { href: "/caixa", label: "Caixa" },
      { href: "/financeiro", label: "Financeiro" },
    ],
  },
  {
    type: "menu",
    label: "Catálogo",
    items: [
      { href: "/servicos", label: "Serviços" },
      { href: "/produtos", label: "Produtos" },
      { href: "/estoque", label: "Estoque" },
      { href: "/materiais", label: "Materiais" },
    ],
  },
  {
    type: "menu",
    label: "Equipe",
    items: [
      { href: "/profissionais", label: "Profissionais" },
      { href: "/comissoes", label: "Comissões" },
    ],
  },
  {
    type: "menu",
    label: "Inteligência",
    items: [
      { href: "/kpis", label: "KPIs" },
      { href: "/relatorios", label: "Relatórios" },
      { href: "/inteligencia", label: "Central" },
    ],
  },
  { type: "link", href: "/configuracoes", label: "Configurações" },
];

const SCOPE_ALLOWED_HREFS: Record<NavScope, Set<string> | null> = {
  manager: null,
  reception: new Set(["/agenda", "/atendimento", "/pdv", "/caixa", "/clientes"]),
  barber: new Set(["/agenda", "/atendimento", "/clientes", "/inteligencia"]),
};

function entryIsActive(entry: NavEntry, pathname: string) {
  if (entry.type === "link") return pathname.startsWith(entry.href);
  return entry.items.some((item) => pathname.startsWith(item.href));
}

export function AppNav({ scope = "manager" }: { scope?: NavScope }) {
  const pathname = usePathname();
  const allowed = SCOPE_ALLOWED_HREFS[scope];
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  const entries = ALL_ENTRIES.map((entry) => {
    if (entry.type === "link") {
      return allowed && !allowed.has(entry.href) ? null : entry;
    }

    const items = allowed
      ? entry.items.filter((item) => allowed.has(item.href))
      : entry.items;

    return items.length > 0 ? { ...entry, items } : null;
  }).filter((entry): entry is NavEntry => entry !== null);

  return (
    <nav
      className="shell flex gap-1 overflow-x-auto"
      aria-label="Navegação principal"
    >
      {entries.map((entry) => {
        const active = entryIsActive(entry, pathname);

        if (entry.type === "link") {
          return (
            <Link
              key={entry.href}
              href={entry.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "text-nav px-3 py-2.5 border-b-2 whitespace-nowrap transition-colors duration-fast ease-standard",
                active
                  ? "border-signal text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              )}
            >
              {entry.label}
            </Link>
          );
        }

        const isOpen = openMenu === entry.label;

        return (
          <div key={entry.label} className="relative shrink-0">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-haspopup="menu"
              onClick={() => setOpenMenu(isOpen ? null : entry.label)}
              className={cn(
                "text-nav px-3 py-2.5 border-b-2 whitespace-nowrap transition-colors duration-fast ease-standard inline-flex items-center gap-1.5",
                active || isOpen
                  ? "border-signal text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              )}
            >
              {entry.label}
              <span aria-hidden="true" className={cn("text-[10px] transition-transform", isOpen && "rotate-180")}>
                ▾
              </span>
            </button>

            {isOpen && (
              <div
                role="menu"
                aria-label={entry.label}
                className="absolute left-0 top-full z-50 mt-1 min-w-44 rounded-md border border-border bg-surface p-1 shadow-lg"
              >
                {entry.items.map((item) => {
                  const itemActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      aria-current={itemActive ? "page" : undefined}
                      onClick={() => setOpenMenu(null)}
                      className={cn(
                        "block rounded-sm px-3 py-2 text-sm transition-colors",
                        itemActive
                          ? "bg-muted text-foreground"
                          : "text-muted hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
