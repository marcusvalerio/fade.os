"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Wordmark } from "@/components/ui/wordmark";

type Papel = "dono" | "recepcao" | "barbeiro";

const ROTULO: Record<Papel, string> = {
  dono: "Dono",
  recepcao: "Recepção",
  barbeiro: "Barbeiro",
};

/**
 * "Cada um vê o seu" — a sidebar real do CORTEX (components/app-nav.tsx) no
 * papel escolhido. Os itens que o papel não usa não somem num piscar: eles
 * recolhem, e o que fica sobe para o lugar. É o escopo de navegação do
 * produto (SCOPE_ALLOWED_HREFS), não uma ilustração: dono vê tudo, recepção
 * vê agenda, clientes, venda e caixa, o barbeiro vê a agenda dele e os
 * clientes. A autorização de verdade é do banco (RLS); a navegação só não
 * oferece o que não é do papel.
 */
export function Papeis({ menu }: { menu: Record<Papel, string[]> }) {
  const [papel, setPapel] = useState<Papel>("dono");
  const todos = menu.dono;

  return (
    <div className="lp-papeis">
      <div className="lp-papeis-escolha" role="group" aria-label="Ver a navegação como">
        {(Object.keys(ROTULO) as Papel[]).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={papel === p}
            onClick={() => setPapel(p)}
            className={cn("lp-papeis-botao", papel === p && "is-ativo")}
          >
            {ROTULO[p]}
          </button>
        ))}
      </div>
      <div className="lp-papeis-sidebar">
        <span className="lp-papeis-marca">
          <Wordmark tamanho="sm" />
        </span>
        <ul className="lp-papeis-menu" aria-label={`Menu do ${ROTULO[papel].toLowerCase()}`}>
          {todos.map((item) => {
            const visivel = menu[papel].includes(item);
            return (
              <li key={item} className="lp-papeis-item" data-visivel={visivel ? "" : undefined} aria-hidden={!visivel}>
                <span className="lp-papeis-item-interno">
                  <span aria-hidden className="lp-papeis-ponto" />
                  {item}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
