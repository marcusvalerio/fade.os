"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operação",
    items: [
      { href: "/agenda", label: "Agenda" },
      { href: "/atendimento", label: "Atendimento" },
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
    ],
  },
  {
    label: "Inteligência",
    items: [{ href: "/inteligencia", label: "Central" }],
  },
  {
    label: "Empresa",
    items: [{ href: "/configuracoes", label: "Configurações" }],
  },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      className="shell flex gap-7 overflow-x-auto"
      aria-label="Navegação principal"
    >
      {NAV_GROUPS.map((group) => (
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
