"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const ENTRIES = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/empresas", label: "Empresas" },
  { href: "/admin/acessos", label: "Acessos Beta" },
  { href: "/admin/usuarios", label: "Usuários" },
  { href: "/admin/auditoria", label: "Auditoria" },
];

export function AdminNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 overflow-x-auto min-w-0">
      {ENTRIES.map((entry) => {
        // "/admin" só fica ativo na rota exata — senão toda subrota também o
        // marcaria, já que todas começam com o mesmo prefixo.
        const active = entry.href === "/admin" ? pathname === "/admin" : pathname.startsWith(entry.href);
        return (
          <Link
            key={entry.href}
            href={entry.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "text-nav px-3 py-2 rounded-sm transition-colors duration-fast ease-standard whitespace-nowrap",
              active ? "text-info bg-white/5 font-medium" : "text-shell-muted hover:text-shell-foreground"
            )}
          >
            {entry.label}
          </Link>
        );
      })}
    </nav>
  );
}
