import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Surface({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  // material-solid (R18): é conteúdo — tabela/lista que se opera o dia
  // inteiro, nunca a camada que flutua por cima. Mesmos valores de sempre
  // (bg-surface + border-border), só nomeados pelo papel que já tinham.
  return (
    <div
      className={cn(
        "material-solid rounded-md divide-y divide-border",
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
