"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";

/**
 * A busca era um <form> sem botão que só filtrava ao apertar Enter — sem
 * nenhum indício visual disso. Quem digitava e olhava a lista parada
 * concluía que a busca não funcionava (R20). Filtra sozinha, com um
 * pequeno atraso para não disparar uma navegação a cada tecla.
 */
export function ClientSearchInput({ initialValue }: { initialValue: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("q", next);
      else params.delete("q");
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    }, 300);
  }

  return (
    <div className="relative max-w-sm">
      <Input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Buscar por nome ou telefone"
      />
      {isPending && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 size-3.5 rounded-full",
            "border-2 border-muted border-t-transparent animate-spin"
          )}
        />
      )}
    </div>
  );
}
