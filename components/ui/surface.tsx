import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Surface({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-surface divide-y divide-border",
        className
      )}
      {...props}
    />
  );
}

// Fica como filho direto de Surface (às vezes dentro de um <Link>) — por
// isso a borda entre linhas vem do divide-y do Surface, não daqui: um
// last:border-b-0 aqui só saberia se É o último filho do próprio <Link>,
// não do Surface, e marcaria toda linha como "última".
export function SurfaceRow({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-4 py-3 transition-colors duration-fast ease-standard",
        className
      )}
      {...props}
    />
  );
}
