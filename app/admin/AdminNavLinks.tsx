"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

const ENTRIES = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/empresas", label: "Empresas" },
  { href: "/admin/acessos", label: "Acessos Beta" },
  { href: "/admin/usuarios", label: "Usuários" },
  { href: "/admin/auditoria", label: "Auditoria" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AdminNavLinks() {
  const pathname = usePathname();
  const router = useRouter();
  const activeEntry = ENTRIES.find((entry) => isActive(pathname, entry.href)) ?? ENTRIES[0];

  return (
    <>
      <nav className="hidden sm:flex items-center gap-1 min-w-0" aria-label="Administração da plataforma">
        {ENTRIES.map((entry) => {
          const active = isActive(pathname, entry.href);
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

      <label className="sm:hidden order-3 w-full flex items-center gap-3" htmlFor="admin-section">
        <span className="sr-only">Seção do Admin</span>
        <select
          id="admin-section"
          value={activeEntry.href}
          onChange={(event) => router.push(event.target.value)}
          className="min-h-10 w-full rounded border border-[var(--shell-border)] bg-[var(--shell-surface)] px-3 text-body-sm text-shell-foreground outline-none"
        >
          {ENTRIES.map((entry) => (
            <option key={entry.href} value={entry.href}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
