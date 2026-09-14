"use client";

import { useState } from "react";
import { FocalImage } from "@/components/ui/focal-point-image";
import { Button } from "@/components/ui/button";

type Pagina = {
  titulo: string;
  texto: string;
  imagemUrl: string | null;
  focalX: number;
  focalY: number;
};

/**
 * P1.5 — apresentação opcional de 2 páginas antes do agendamento. Só
 * aparece quando a barbearia ligou a opção E preencheu conteúdo de verdade
 * (nunca lorem ipsum): cada página sem título+texto próprios é pulada, e
 * se nenhuma das duas tiver conteúdo o gate nem monta — o cliente cai
 * direto no formulário, como sempre foi.
 *
 * Composição editorial (TEXTO + FOTO), não carrossel nem wizard de passos.
 */
export function OnboardingGate({
  paginas,
  children,
}: {
  paginas: Pagina[];
  children: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const valid = paginas.filter((p) => p.titulo.trim() && p.texto.trim());

  if (valid.length === 0) return <>{children}</>;
  if (index >= valid.length) return <>{children}</>;

  const pagina = valid[index];
  const ultima = index === valid.length - 1;

  return (
    <div className="animate-fade-in">
      <div className="shell max-w-2xl py-10 sm:py-16">
        {pagina.imagemUrl && (
          <FocalImage
            src={pagina.imagemUrl}
            alt=""
            focalX={pagina.focalX}
            focalY={pagina.focalY}
            className="aspect-[4/3] sm:aspect-[16/9] w-full rounded-md mb-8"
          />
        )}
        <h1 className="font-heading text-[1.75rem] sm:text-[2.25rem] leading-[1.08] tracking-[-0.01em] text-foreground">
          {pagina.titulo}
        </h1>
        <p className="text-body text-muted mt-4 max-w-lg whitespace-pre-line">{pagina.texto}</p>

        <div className="mt-9 flex items-center gap-5">
          <Button type="button" onClick={() => setIndex((i) => i + 1)}>
            {ultima ? "Ver horários" : "Continuar"}
          </Button>
          {!ultima && (
            <button
              type="button"
              onClick={() => setIndex(valid.length)}
              className="min-h-11 inline-flex items-center text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard"
            >
              Pular apresentação
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
