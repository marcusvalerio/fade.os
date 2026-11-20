"use client";

import { useTransition } from "react";
import { setActiveCompany } from "@/actions/company-context";
import { cn } from "@/lib/cn";

/**
 * Troca de barbearia, dentro do menu da conta. Só aparece para quem tem mais
 * de uma — a escolha é explícita e persistida (cookie validado a cada
 * leitura em getCurrentCompany), nunca "a primeira que apareceu".
 */
export function CompanySwitcher({
  current,
  companies,
}: {
  current: { id: string; name: string };
  companies: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();

  if (companies.length <= 1) return null;

  return (
    <div>
      <p className="font-subtitle text-micro uppercase tracking-label text-shell-muted mb-1">Barbearia</p>
      <ul>
        {companies.map((c) => {
          const atual = c.id === current.id;
          return (
            <li key={c.id}>
              <button
                type="button"
                disabled={pending || atual}
                aria-current={atual ? "true" : undefined}
                onClick={() => startTransition(() => setActiveCompany(c.id))}
                className={cn(
                  "w-full min-h-9 flex items-center gap-2 text-left text-body-sm rounded-xs px-1.5",
                  atual ? "text-shell-foreground" : "text-shell-muted hover:text-shell-foreground hover:bg-surface-muted/60"
                )}
              >
                <span aria-hidden className={cn("size-1.5 shrink-0", atual ? "bg-brand-blue" : "bg-transparent")} />
                <span className="truncate">{c.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
