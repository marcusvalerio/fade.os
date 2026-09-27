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
          <p className="font-subtitle text-micro uppercase tracking-label text-shell-muted/80 px-3 mb-1.5">{group.label}</p>
          <div className="flex flex-col gap-px">
            {group.entries.map((entry) => {
              const active = isAdminNavActive(pathname, entry.href);
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center text-nav px-3 py-1.5 rounded-sm transition-colors duration-micro ease-standard",
                    active ? "text-shell-accent bg-white/[0.05]" : "text-shell-muted hover:text-shell-foreground hover:bg-white/[0.03]",
                    group.label === "Não conectado" && !active && "text-shell-muted/60"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("absolute left-0 size-1.5 bg-shell-accent transition-transform duration-interacao ease-sinal", active ? "scale-100" : "scale-0")}
                  />
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
        className="min-h-10 w-full rounded-sm border border-shell-border bg-surface px-3 text-body-sm text-shell-foreground"
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
