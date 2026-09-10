"use client";

import { useEffect, useState } from "react";
import { Wordmark } from "@/components/ui/wordmark";
import { cn } from "@/lib/cn";

/**
 * A marca se escrevendo.
 *
 *   C · CO · COR · CORT · CORTE · CORTEX · CORTEX. · CORTEX.O · CORTEX.OS
 *
 * O gesto é simples e a razão dele também: a marca não aparece pronta, ela é
 * digitada — como um sistema que acabou de ligar. Mas isso só é encantador na
 * primeira vez. Da segunda em diante vira pedágio, então quem já entrou uma
 * vez recebe a versão curta, e o formulário nunca espera pela animação: as
 * duas coisas fazem parte do mesmo movimento, com o formulário subindo
 * enquanto as últimas letras ainda entram.
 *
 * Quem pediu menos movimento não recebe movimento nenhum — a marca já nasce
 * completa.
 */
const CHAVE = "cortex.abertura-vista";

export function AberturaDaMarca({ children }: { children: React.ReactNode }) {
  const [letras, setLetras] = useState<number | null>(null);
  const nome = "CORTEX";
  const sufixo = "OS";
  const total = nome.length + 1 + sufixo.length;

  useEffect(() => {
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let jaViu = false;
    try {
      jaViu = window.localStorage.getItem(CHAVE) === "1";
    } catch {
      // Navegação privada, cookies bloqueados: trata como primeira vez. Uma
      // abertura a mais é melhor do que uma tela quebrada.
    }

    if (reduzido) {
      setLetras(total);
      return;
    }

    // Primeira visita: a marca se escreve inteira. Depois: entra pronta, com
    // só o fade de composição.
    const passo = jaViu ? 26 : 62;
    const inicio = jaViu ? total - 2 : 1;
    setLetras(inicio);

    let atual = inicio;
    const id = window.setInterval(() => {
      atual += 1;
      setLetras(atual);
      if (atual >= total) {
        window.clearInterval(id);
        try {
          window.localStorage.setItem(CHAVE, "1");
        } catch {
          /* sem persistência, sem problema */
        }
      }
    }, passo);

    return () => window.clearInterval(id);
  }, [total]);

  // Antes do efeito rodar, letras === null: renderiza a marca completa e
  // invisível, para o layout já nascer no tamanho final e nada saltar.
  const visiveis = letras ?? total;
  const escrito = (nome + "." + sufixo).slice(0, visiveis);
  const parte = escrito.split(".");
  const completo = visiveis >= total;

  return (
    <div className="w-full max-w-sm">
      <div className="flex justify-center mb-8" aria-hidden={letras !== null && !completo}>
        <Wordmark
          nome={parte[0] ?? ""}
          sufixo={parte[1] ?? ""}
          tamanho="lg"
          className={cn(
            "transition-opacity duration-normal ease-out",
            letras === null ? "opacity-0" : "opacity-100"
          )}
        />
      </div>

      {/*
        O formulário não espera a marca terminar — ele sobe junto, com um
        atraso curto. É o que faz a tela parecer uma composição só em vez de
        duas cenas emendadas.
      */}
      <div className="animate-rise-in [animation-delay:180ms] [animation-fill-mode:both]">{children}</div>
    </div>
  );
}
