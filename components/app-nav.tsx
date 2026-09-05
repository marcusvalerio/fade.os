"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { href: "/agenda", label: "Agenda" },
  { href: "/atendimento", label: "Atendimento" },
  { href: "/clientes", label: "Clientes" },
  { href: "/profissionais", label: "Profissionais" },
  { href: "/servicos", label: "Serviços" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="shell flex gap-6 overflow-x-auto" aria-label="Navegação principal">
      {NAV_ITEMS.map((item) => {
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
    </nav>
  );
}
