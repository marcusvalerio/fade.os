"use client";

import { useState, useTransition } from "react";
import { setActiveCompany } from "@/actions/company-context";
import { cn } from "@/lib/cn";
import { GlassSurface } from "@/components/ui/glass-surface";

/**
 * Só renderiza algo quando o usuário realmente tem mais de uma empresa —
 * a maioria nunca vai ver isso. Existe para que "empresa ativa" seja uma
 * escolha explícita e persistida (cookie, validada a cada leitura em
 * getCurrentCompany), nunca "a primeira que apareceu".
 */
export function CompanySwitcher({
  current,
  companies,
}: {
  current: { id: string; name: string };
  companies: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (companies.length <= 1) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-body-sm text-shell-muted hover:text-shell-foreground transition-colors duration-fast ease-standard"
      >
        Trocar empresa ▾
      </button>
      {open && (
        <GlassSurface
          tone="shell"
          className="absolute right-0 top-full mt-2 w-56 rounded-md z-[var(--z-dropdown)] animate-scale-in py-1"
        >
          {companies.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                startTransition(() => setActiveCompany(c.id));
              }}
              className={cn(
                "w-full text-left px-3 py-2 text-body-sm transition-colors duration-fast ease-standard",
                c.id === current.id ? "text-shell-foreground font-medium" : "text-shell-muted hover:text-shell-foreground"
              )}
            >
              {c.name}
            </button>
          ))}
        </GlassSurface>
      )}
    </div>
  );
}
