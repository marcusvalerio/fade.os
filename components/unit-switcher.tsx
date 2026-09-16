"use client";

import { useState, useTransition } from "react";
import { setActiveUnit } from "@/actions/company-context";
import { cn } from "@/lib/cn";
import { GlassSurface } from "@/components/ui/glass-surface";

export function UnitSwitcher({
  current,
  units,
}: {
  current: { id: string; name: string };
  units: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (units.length <= 1) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-body-sm text-shell-muted hover:text-shell-foreground transition-colors duration-fast ease-standard"
        aria-expanded={open}
      >
        Trocar unidade ▾
      </button>
      {open && (
        <GlassSurface
          tone="shell"
          className="absolute right-0 top-full mt-2 w-56 rounded-md z-[var(--z-dropdown)] animate-scale-in py-1"
        >
          {units.map((unit) => (
            <button
              key={unit.id}
              type="button"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                startTransition(() => setActiveUnit(unit.id));
              }}
              className={cn(
                "w-full text-left px-3 py-2 text-body-sm transition-colors duration-fast ease-standard",
                unit.id === current.id
                  ? "text-shell-foreground font-medium"
                  : "text-shell-muted hover:text-shell-foreground"
              )}
            >
              {unit.name}
            </button>
          ))}
        </GlassSurface>
      )}
    </div>
  );
}
