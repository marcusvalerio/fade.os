"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/cn";

const OPTIONS = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
  { value: "system", label: "Sistema" },
] as const;

export function ThemeToggle({ tom = "conteudo" }: { tom?: "conteudo" | "tinta" }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div
      className={cn(
        "inline-flex rounded-sm border p-0.5 text-caption",
        tom === "tinta" ? "border-rule-on-ink" : "border-border-strong"
      )}
      role="radiogroup"
      aria-label="Tema"
    >
      {OPTIONS.map((option) => {
        const active = mounted && theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(option.value)}
            className={cn(
              "px-2.5 py-1 rounded-xs transition-colors duration-fast ease-standard",
              active
                ? "bg-brand-blue text-neutral-ink"
                : tom === "tinta"
                  ? "text-on-ink-muted hover:text-on-ink"
                  : "text-muted hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
