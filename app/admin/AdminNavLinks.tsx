"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { ADMIN_NAV_FLAT, ADMIN_NAV_GROUPS, isAdminNavActive } from "./admin-nav";

/**
 * Duas formas do mesmo dado (admin-nav.ts): uma sidebar vertical agrupada
 * para desktop/tablet largo, e um <select> plano para telas estreitas —
 * nunca as duas ao mesmo tempo, para não duplicar a navegação como uma
 * segunda camada visual.
 */
export function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5" aria-label="Administração da plataforma">
      {ADMIN_NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="text-label uppercase tracking-label text-shell-muted/70 px-3 mb-1.5">{group.label}</p>
          <div className="flex flex-col gap-0.5">
            {group.entries.map((entry) => {
              const active = isAdminNavActive(pathname, entry.href);
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "text-nav px-3 py-2 rounded-sm transition-colors duration-fast ease-standard",
                    active ? "text-info bg-white/5 font-medium" : "text-shell-muted hover:text-shell-foreground"
                  )}
                >
                  {entry.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AdminMobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const active = ADMIN_NAV_FLAT.find((entry) => isAdminNavActive(pathname, entry.href)) ?? ADMIN_NAV_FLAT[0];

  return (
    <label className="w-full flex items-center gap-3" htmlFor="admin-section">
      <span className="sr-only">Seção do Admin</span>
      <select
        id="admin-section"
        value={active.href}
        onChange={(event) => router.push(event.target.value)}
        className="min-h-10 w-full rounded border border-shell-border bg-[var(--shell-surface)] px-3 text-body-sm text-shell-foreground outline-none"
      >
        {ADMIN_NAV_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.entries.map((entry) => (
              <option key={entry.href} value={entry.href}>
                {entry.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
