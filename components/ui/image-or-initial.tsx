"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * P1.18 — avatar/logo com URL configurada que falha ao carregar (arquivo
 * removido do storage, link quebrado) cai para a mesma letra-inicial que já
 * é o fallback de "sem imagem configurada" — nunca o ícone padrão de imagem
 * quebrada do navegador, na página pública da barbearia.
 */
export function ImageOrInitial({
  src,
  alt,
  label,
  className,
  imgClassName,
}: {
  src: string | null | undefined;
  alt: string;
  /** Texto de onde a inicial é extraída (nome da pessoa/empresa). */
  label: string;
  className?: string;
  imgClassName?: string;
}) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <div aria-hidden className={cn("bg-surface-muted flex items-center justify-center text-foreground", className)}>
        {label.trim().charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={cn(className, imgClassName)} onError={() => setBroken(true)} />
  );
}
