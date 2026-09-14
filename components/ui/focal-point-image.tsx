"use client";

/**
 * P1.4 — o mesmo padrão de enquadramento para TODA imagem configurável da
 * página pública (capa, apresentação, diferenciais): nunca um crop de
 * pixels reprocessado no servidor, sempre um contêiner de proporção fixa +
 * `object-fit: cover` + `object-position` no ponto focal escolhido. Isso
 * garante, sozinho, que a imagem nunca estica, nunca deforma e se comporta
 * igual em qualquer largura de tela — não existe "versão mobile" separada
 * do crop.
 *
 * P1.18 — uma URL configurada pode ficar indisponível (arquivo removido do
 * storage, link quebrado): sem tratamento, o navegador mostra o ícone
 * padrão de imagem quebrada, nunca aceitável numa página pública. `onError`
 * troca para o mesmo placeholder neutro do caso "sem imagem configurada" —
 * por isso o componente precisa ser client (o evento só existe no browser).
 */
import { useState } from "react";
import { cn } from "@/lib/cn";

export function FocalImage({
  src,
  alt,
  focalX = 0.5,
  focalY = 0.5,
  aspectRatio,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  focalX?: number;
  focalY?: number;
  /** Quando omitido, a proporção vem de classes Tailwind (`aspect-*`) no `className`. */
  aspectRatio?: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <div
        aria-hidden
        className={cn("bg-surface-muted", !aspectRatio && "aspect-video", className)}
        style={aspectRatio ? { aspectRatio } : undefined}
      />
    );
  }

  return (
    <div
      className={cn("overflow-hidden bg-surface-muted", !aspectRatio && "aspect-video", className)}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="size-full object-cover"
        style={{ objectPosition: `${focalX * 100}% ${focalY * 100}%` }}
        onError={() => setBroken(true)}
      />
    </div>
  );
}
