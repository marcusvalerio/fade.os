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

export function AdminNavLinks() {
  const pathname = usePathname();
  const router = useRouter();
  const activeEntry = ENTRIES.find((entry) =>
    entry.href === "/admin" ? pathname === "/admin" : pathname.startsWith(entry.href)
  ) ?? ENTRIES[0];

  return (
    <>
      <nav className="hidden sm:flex items-center gap-1 overflow-x-auto min-w-0" aria-label="Administração">
        {ENTRIES.map((entry) => {
          const active = entry.href === "/admin" ? pathname === "/admin" : pathname.startsWith(entry.href);
          return (
            <Link
              key={entry.href}
              href={entry.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "min-h-11 inline-flex items-center text-nav px-3 py-2 rounded-sm transition-colors duration-fast ease-standard whitespace-nowrap",
                active ? "text-info bg-white/5 font-medium" : "text-shell-muted hover:text-shell-foreground"
              )}
            >
              {entry.label}
            </Link>
          );
        })}
      </nav>

      <label className="sm:hidden flex-1 min-w-0">
        <span className="sr-only">Seção do Admin</span>
        <select
          value={activeEntry.href}
          onChange={(event) => router.push(event.target.value)}
          className="w-full min-h-11 rounded-md border border-[var(--shell-border)] bg-white/5 px-3 text-body-sm text-shell-foreground outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          {ENTRIES.map((entry) => (
            <option key={entry.href} value={entry.href} className="bg-[var(--neutral-ink)] text-shell-foreground">
              {entry.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
